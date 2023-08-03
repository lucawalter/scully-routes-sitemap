"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSitemapConfig = exports.SitemapConfig = exports.SitemapRoute = exports.useSitemapPlugin = exports.sitemapPlugin = void 0;
const scully_1 = require("@scullyio/scully");
const fast_xml_parser_1 = require("fast-xml-parser");
const fs = require("fs");
const path = require("path");
const path_to_regexp_1 = require("path-to-regexp");
const builder = require("xmlbuilder");
const SitemapPlugin = 'SitemapGenerator';
const today = new Date();
const xmlParser = new fast_xml_parser_1.XMLParser();
const mergePaths = (base, urlPath) => {
    if (base.endsWith('/') && urlPath.startsWith('/')) {
        return `${base}${urlPath.substring(1)}`;
    }
    if (!base.endsWith('/') && !urlPath.startsWith('/')) {
        return `${base}/${urlPath}`;
    }
    return `${base}${urlPath}`;
};
const priorityForLocation = (loc, config) => {
    if (typeof config.priority === 'string' || config.priority instanceof String) {
        return config.priority;
    }
    else if (Array.isArray(config.priority)) {
        const segments = loc.split('/');
        return config.priority[segments.length - 1];
    }
    else {
        return '0.5';
    }
};
const pluralizer = (num, singular, plural) => {
    return num === 1 ? singular : plural;
};
const configForRoute = (config, route) => {
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
const getSitemapFile = (filename) => {
    return path.join(scully_1.scullyConfig.outDir ?? './', filename);
};
const getRobotsFile = () => {
    return path.join(scully_1.scullyConfig.outDir ?? './', 'robots.txt');
};
const loadMap = (filename) => {
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
    }
    else {
        return null;
    }
};
const saveMap = (map, filename) => {
    const file = getSitemapFile(filename);
    const rootElement = builder.create('urlset').att('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');
    for (const route of Object.values(map)) {
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
const generateRobotsFile = (config) => {
    let prefix = config.urlPrefix ?? exports.defaultSitemapConfig.urlPrefix;
    if (prefix?.endsWith('/')) {
        prefix = prefix.substring(0, prefix.length - 2);
    }
    const sitemapUri = `${prefix}/${config.sitemapFilename ?? exports.defaultSitemapConfig.sitemapFilename}`;
    const allowAllGroup = ['User-agent: *', 'Allow: /'];
    const groups = [allowAllGroup.join('\n'), `Sitemap: ${sitemapUri}`];
    fs.writeFileSync(getRobotsFile(), groups.join('\n\n'));
};
const parseXml = (xmlString) => {
    return xmlParser.parse(xmlString);
};
const getMapForRoute = (maps, routeConfig) => {
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
const sitemapPlugin = async (routes) => {
    const config = Object.assign({}, exports.defaultSitemapConfig, (0, scully_1.getPluginConfig)(SitemapPlugin));
    const log = (message, ...optionalParams) => {
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
            config.routes[key].regexp = (0, path_to_regexp_1.pathToRegexp)(key);
        });
    }
    const maps = {};
    routes.forEach((route) => {
        if (config.ignoredRoutes) {
            const ignore = config.ignoredRoutes.reduce((prev, curr) => {
                if (typeof curr === 'string') {
                    return prev || route.route === curr;
                }
                return prev || curr.test(route.route);
            }, false);
            if (ignore)
                return;
        }
        const routeConfig = configForRoute(config, route);
        const map = getMapForRoute(maps, routeConfig);
        const prefix = routeConfig.urlPrefix ?? exports.defaultSitemapConfig.urlPrefix;
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
exports.sitemapPlugin = sitemapPlugin;
const validator = async () => [];
const useSitemapPlugin = (config) => {
    (0, scully_1.registerPlugin)('routeDiscoveryDone', SitemapPlugin, exports.sitemapPlugin, validator);
    (0, scully_1.setPluginConfig)(SitemapPlugin, config);
};
exports.useSitemapPlugin = useSitemapPlugin;
/**
 * The sitemap configuration options.
 */
class SitemapRoute {
    /** The path RegExp (automatically generated) */
    regexp;
    /** What is the base url to your app. */
    urlPrefix;
    /** How often is the route expected to change? */
    changeFreq;
    /** Where do you want to store the sitemap file? */
    sitemapFilename;
    /** Merge handled routes into existing sitemap file (if available)? */
    merge;
    /** A list of priorities to set based on number of segments in the route */
    priority;
    /** would you like to append a trailing slash to the url */
    trailingSlash;
    /** Last modification datetime (YYYY-MM-DDTHH:mm:ss.sssZ = date.toISOString()) */
    lastMod;
}
exports.SitemapRoute = SitemapRoute;
/**
 * The sitemap configuration options.
 */
class SitemapConfig {
    /** What is the base url to your app. */
    urlPrefix;
    /** Where do you want to store the sitemap file? */
    sitemapFilename;
    /** Create a robots.txt file which includes the created sitemap **/
    createRobotsFile;
    /** Merge handled routes into existing sitemap file (if available)? */
    merge;
    /** How often is the route expected to change? */
    changeFreq;
    /** A list of priorities to set based on number of segments in the route */
    priority;
    /** Last modification datetime (YYYY-MM-DDTHH:mm:ss.sssZ = date.toISOString()) */
    lastMod;
    /** A list of routes not to include in the sitemap */
    ignoredRoutes;
    /** If `true`, the plugin will not log status messages to the console. */
    suppressLog;
    /** List of optional configuration for specific routes */
    routes;
    /** would you like to append a trailing slash to the url */
    trailingSlash;
}
exports.SitemapConfig = SitemapConfig;
/**
 * The default configuration
 */
exports.defaultSitemapConfig = {
    urlPrefix: 'http://localhost',
    sitemapFilename: 'sitemap.xml',
    createRobotsFile: false,
    merge: false,
    changeFreq: 'monthly',
    priority: '0.5',
    suppressLog: false,
    trailingSlash: false
};
