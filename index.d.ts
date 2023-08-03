import { HandledRoute } from '@scullyio/scully';
export declare const sitemapPlugin: (routes?: HandledRoute[]) => Promise<void>;
export declare const useSitemapPlugin: (config: SitemapConfig) => void;
/**
 * The sitemap configuration options.
 */
export declare class SitemapRoute {
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
export declare class SitemapConfig {
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
    routes?: {
        [route: string]: SitemapRoute;
    };
    /** would you like to append a trailing slash to the url */
    trailingSlash?: boolean;
}
/**
 * The default configuration
 */
export declare const defaultSitemapConfig: SitemapConfig;
