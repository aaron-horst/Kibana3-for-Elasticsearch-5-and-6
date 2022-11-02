/** @scratch /configuration/config.js/1
 *
 * == Configuration
 * config.js is where you will find the core Kibana configuration. This file contains parameter that
 * must be set before kibana is run for the first time.
 */
define(['settings'],
function (Settings) {
  "use strict";

  /** @scratch /configuration/config.js/2
   *
   * === Parameters
   */
  return new Settings({

    /** @scratch /configuration/config.js/5
     *
     * ==== elasticsearch
     *
     * The URL to your elasticsearch server. You almost certainly don't
     * want +http://localhost:9200+ here. Even if Kibana and Elasticsearch are on
     * the same host. By default this will attempt to reach ES at the same host you have
     * kibana installed on. You probably want to set it to the FQDN of your
     * elasticsearch host
     */
    elasticsearch: "http://"+window.location.hostname+":9200",

    /** @scratch /configuration/config.js/5
     *
     * ==== api_version
     *
     * The elasticsearch api version you want to use. This must match the version of your elasticsearch server.
     *
     * Valid version: 0.9, 1.0, 1.1, 1.2
     */
    api_version: "1.0",

    /** @scratch /configuration/config.js/5
     *
     * ==== sniff
     *
     * Whether to sniff elasticsearch nodes on kibana start. kibana would send queries to nodes by round-robin. You may want to set to false if you had a proxy before elasticsearch cluster.
     *
     * Valid value: true, false
     */
    sniff: true,

    /** @scratch /configuration/config.js/5
     *
     * ==== request_timeout
     *
     * The timeout in milliseconds for requests to Elasticsearch
     */
    request_timeout: 30000,

    /** @scratch /configuration/config.js/5
     *
     * ==== default_route
     *
     * This is the default landing page when you don't specify a dashboard to load. You can specify
     * files, scripts or saved dashboards here. For example, if you had saved a dashboard called
     * `WebLogs' to elasticsearch you might use:
     *
     * default_route: '/dashboard/elasticsearch/WebLogs',
     */
    default_route     : '/dashboard/file/default.json',

    /** @scratch /configuration/config.js/5
     *
     * ==== kibana-int
     *
     * The default ES index to use for storing Kibana specific object
     * such as stored dashboards
     */
    kibana_index: "kibana3-int",


    /*
     * display notice on top of the page. you could config it as below
      notice: {
      'title':'kibana3 update',
      'text': 'Now updated to support Elasticsearch version 5.x!',
     },*/
     
     notice: null,

     /*
     * choose which catetory the dashboard belong to when save dashboard
     */
     dashboard_class: null,
    /** @scratch /configuration/config.js/5
     *
     * ==== panel_name
     *
     * An array of panel modules available. Panels will only be loaded when they are defined in the
     * dashboard, but this list is used in the "add panel" interface.
     */
    panel_names: [
      'histogram',
      'map',
      'goal',
      'table',
      'filtering',
      'timepicker',
      'text',
      'hits',
      'column',
      'trends',
      'bettermap',
      'query',
      'terms',
      'stats',
      'sparklines',
      'ranges',
      'percentiles'
    ],

    /** @scratch /configuration/config.js/5
     *
     * ==== dashboard_metrics
     *
     * Whether to update kibana_index dashboard docs with view metrics
     *
     * Valid value: true, false
     */
    dashboard_metrics: false,

    /** @scratch /configuration/config.js/5
     *
     * ==== enable_webhooks
     *
     * Optional webhook URL triggered when viewing a dashboard
     * 
     * Valid value: true, false
     */
     enable_webhooks: true,

    /** @scratch /configuration/config.js/5
     *
     * ==== dashboard_view_webhook_url
     *
     * Optional webhook URL triggered when viewing a dashboard
     */
     dashboard_view_webhook_url: "http://127.0.0.1:5601/webhook",

  });
});