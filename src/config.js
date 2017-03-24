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
    elasticsearch: "http://bi-eslb.ihire.local:9200",
    

    /*
    * logout kibana
    */
    logout: "/logout",
    /*
    * show username and logout link on the right of the navbar
    */
    showuser: false,

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
    kibana_index: "kibana-int3",


    /*
     * display notice on top of the page. you could config it as below
    notice: {
      'title':'kibana3 update',
      'text': 'now kibana3 support es2!',
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
      
      'histogram',  // k3 version
      'map', // k3 version
      'goal',  // k3 version
      'table', // k3 version
      'filtering',
      'timepicker',
      'text', // k3 version
      'hits', // k3 version
      'column',  // k3 version
      'trends', // k3 version
      'bettermap', // k3 version
      'query',
      'terms', // k3 version
      'stats', // k3 version
      'sparklines' // k3 version

       // new visualizations introduced in the fork - removed for backward compatibility testing
       // 'multiplechoice',
       // 'entry', // this displays all dashboards - don't need it
       // 'filtertable', // just like a table but shows all options instead
       // 'percentiles', // new: used to show 25/50/75 percentiles
       // 'ranges', // new: used to show predefined ranges
       // 'force',
       // 'statisticstrend',
       // 'multifieldhistogram',
       // 'valuehistogram'
    ],

    /*
    * whether or not to display the query generator option
    */
    showquerygenerator: false,


  });
});
