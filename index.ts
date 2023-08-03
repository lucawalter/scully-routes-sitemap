import { getPluginConfig, HandledRoute, registerPlugin, scullyConfig, setPluginConfig } from '@scullyio/scully';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import { pathToRegexp } from 'path-to-regexp';
import * as builder from 'xmlbuilder';

const SitemapPlugin = 'SitemapGenerator';
const today = new Date();
const xmlParser = new XMLParser();

const mergePaths = (base: string, urlPath: string): string => {
    if (base.endsWith('/') && urlPath.startsWith('/')) {
        return `${base}${urlPath.substring(1)}`;
    }
    if (!base.endsWith('/') && !urlPath.startsWith('/')) {
        return `${base}/${urlPath}`;
    }
    return `${base}${urlPath}`;
};

const priorityForLocation = (loc: string, config: SitemapConfig) => {
    if (typeof config.priority === 'string') {
        return config.priority;
    } else if (Array.isArray(config.priority)) {
        const segments = loc.split('/');
        return config.priority[segments.length - 1];
    } else {
        return '0.5';
    }
};

const pluralizer = (num: number, singular: string, plural: string) => {
    return num === 1 ? singular : plural;
};

const configForRoute = (config: SitemapConfig, route: HandledRoute) => {
    if (config.routes) {
        // tslint:disable-next-line:forin
        for (const routePath in config.routes) {
            const routeConfig = config.routes[routePath];
            if (!!routeConfig.regexp && route.route.match(routeConfig.regexp)) {
                return {
                    route: route.route,
                    urlPrefix: routeConfig.urlPrefix || config.urlPrefix,
                    trailingSlash: routeConfig.trailingSlash || config.trailingSlash,
                    sitemapFilename: routeConfig.sitemapFilename || config.sitemapFilename,
                    merge: routeConfig.merge || config.merge,
                    changeFreq: routeConfig.changeFreq || config.changeFreq,
                    priority: routeConfig.priority || config.priority,
                    lastMod: routeConfig.lastMod || config.lastMod
                };
            }
        }
    }
    return {
        route: route.route,
        urlPrefix: config.urlPrefix,
        trailingSlash: config.trailingSlash,
        sitemapFilename: config.sitemapFilename,
        merge: config.merge,
        changeFreq: config.changeFreq,
        priority: config.priority,
        lastMod: config.lastMod
    };
};

const getSitemapFile = (filename: string) => {
    return path.join(scullyConfig.outDir ?? './', filename);
};

const getRobotsFile = () => {
    return path.join(scullyConfig.outDir ?? './', 'robots.txt');
};

const loadMap = (filename: string) => {
    const file = getSitemapFile(filename);
    if (fs.existsSync(file)) {
        const xmlString = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' });
        const xml = parseXml(xmlString);
        // build url object
        const map = {};
        for (const mappedUrl of xml.urlset.url) {
            // @ts-ignore
            map[mappedUrl.loc] = mappedUrl;
        }
        return map;
    } else {
        return null;
    }
};

const saveMap = (map: any, filename: string) => {
    const file = getSitemapFile(filename);
    const rootElement = builder.create('urlset').att('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');
    for (const route of Object.values(map) as any[]) {
        const urlElement = rootElement.ele('url');
        urlElement.ele('loc', route.loc);
        urlElement.ele('changefreq', route.changefreq);
        urlElement.ele('lastmod', route.lastmod);
        urlElement.ele('priority', route.priority);
    }
    const xml = rootElement.end({ pretty: true });
    fs.writeFileSync(file, xml);
    return rootElement;
};

const generateRobotsFile = (config: SitemapConfig) => {
    let prefix = config.urlPrefix ?? defaultSitemapConfig.urlPrefix;
    if (prefix?.endsWith('/')) {
        prefix = prefix.substring(0, prefix.length - 2);
    }
    const sitemapUri = `${prefix}/${config.sitemapFilename ?? defaultSitemapConfig.sitemapFilename}`;
    const allowAllGroup = ['User-agent: *', 'Allow: /'];
    const groups = [allowAllGroup.join('\n'), `Sitemap: ${sitemapUri}`];
    fs.writeFileSync(getRobotsFile(), groups.join('\n\n'));
};

const parseXml = (xmlString: string) => {
    return xmlParser.parse(xmlString);
};

const getMapForRoute = (maps: any, routeConfig: any) => {
    let map = maps[routeConfig.sitemapFilename];
    if (!map && routeConfig.merge) {
        map = loadMap(routeConfig.sitemapFilename);
    }
    if (!map) {
        map = {};
    }
    maps[routeConfig.sitemapFilename] = map;
    return map;
};

export const sitemapPlugin = async (routes?: HandledRoute[]): Promise<void> => {
    const config = Object.assign({}, defaultSitemapConfig, getPluginConfig(SitemapPlugin));

    const log = (message?: any, ...optionalParams: any[]): void => {
        if (!config.suppressLog) {
            console.log(message, ...optionalParams);
        }
    };

    log(`Started @recursyve/scully-sitemap`);

    if (!routes) {
        log(`No routes were returned by Scully`);
        return;
    }

    log(`Generating sitemaps for ${routes.length} ${pluralizer(routes.length, 'route', 'routes')}.`);

    // parse route configurations
    if (config.routes) {
        Object.keys(config.routes).forEach((key) => {
            // @ts-ignore
            config.routes[key].regexp = pathToRegexp(key);
        });
    }

    const maps = {};

    routes.forEach((route: HandledRoute) => {
        if (config.ignoredRoutes) {
            const ignore = config.ignoredRoutes.reduce((prev, curr) => {
                if (typeof curr === 'string') {
                    return prev || route.route === curr;
                }
                return prev || curr.test(route.route);
            }, false);
            if (ignore) return;
        }
        const routeConfig = configForRoute(config, route);
        const map = getMapForRoute(maps, routeConfig);
        const prefix = routeConfig.urlPrefix ?? defaultSitemapConfig.urlPrefix!;
        let loc = mergePaths(prefix, route.route);
        if (routeConfig.trailingSlash && !loc.endsWith('/')) {
            loc = loc + '/';
        }
        map[loc] = {
            loc,
            changefreq: routeConfig.changeFreq,
            lastmod: routeConfig.lastMod ?? today.toISOString(),
            priority: priorityForLocation(route.route, routeConfig)
        };
    });

    // tslint:disable-next-line: forin
    for (const filename in maps) {
        // @ts-ignore
        const rootElement = saveMap(maps[filename], filename);
        const routeCount = rootElement.children.length;
        log(`Wrote ${routeCount} ${pluralizer(routeCount, 'route', 'routes')} to ${filename}`);
    }

    if (config.createRobotsFile) {
        log('Generating robots.txt file');
        generateRobotsFile(config);
        log('Wrote robots.txt file');
    }

    log(`Finished @recursyve/scully-sitemap`);
};

const validator = async () => [];

export const useSitemapPlugin = (config: SitemapConfig) => {
    registerPlugin('routeDiscoveryDone', SitemapPlugin, sitemapPlugin, validator);
    setPluginConfig(SitemapPlugin, config);
};

/**
 * The sitemap configuration options.
 */
export class SitemapRoute {
    /** The path RegExp (automatically generated) */
    regexp?: RegExp;

    /** What is the base url to your app. */
    urlPrefix?: string;

    /** How often is the route expected to change? */
    changeFreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

    /** Where do you want to store the sitemap file? */
    sitemapFilename?: string;

    /** Merge handled routes into existing sitemap file (if available)? */
    merge?: boolean;

    /** A list of priorities to set based on number of segments in the route */
    priority?: string | string[];

    /** would you like to append a trailing slash to the url */
    trailingSlash?: boolean;

    /** Last modification datetime (YYYY-MM-DDTHH:mm:ss.sssZ = date.toISOString()) */
    lastMod?: string;
}

/**
 * The sitemap configuration options.
 */
export class SitemapConfig {
    /** What is the base url to your app. */
    urlPrefix?: string;

    /** Where do you want to store the sitemap file? */
    sitemapFilename?: string;

    /** Create a robots.txt file which includes the created sitemap **/
    createRobotsFile?: boolean;

    /** Merge handled routes into existing sitemap file (if available)? */
    merge?: boolean;

    /** How often is the route expected to change? */
    changeFreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

    /** A list of priorities to set based on number of segments in the route */
    priority?: string | string[];

    /** Last modification datetime (YYYY-MM-DDTHH:mm:ss.sssZ = date.toISOString()) */
    lastMod?: string;

    /** A list of routes not to include in the sitemap */
    ignoredRoutes?: (string | RegExp)[];

    /** If `true`, the plugin will not log status messages to the console. */
    suppressLog?: boolean;

    /** List of optional configuration for specific routes */
    routes?: { [route: string]: SitemapRoute };

    /** would you like to append a trailing slash to the url */
    trailingSlash?: boolean;
}

/**
 * The default configuration
 */
export const defaultSitemapConfig: SitemapConfig = {
    urlPrefix: 'http://localhost',
    sitemapFilename: 'sitemap.xml',
    createRobotsFile: false,
    merge: false,
    changeFreq: 'monthly',
    priority: '0.5',
    suppressLog: false,
    trailingSlash: false
};
