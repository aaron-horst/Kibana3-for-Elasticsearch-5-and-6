define([
  'angular',
  'jquery',
  'kbn',
  'lodash',
  'config',
  'moment',
  'modernizr',
  'filesaver',
  'blob'
],
function (angular, $, kbn, _, config, moment, Modernizr) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('dashboard', function(
    $routeParams, $http, $rootScope, $injector, $location, $timeout,
    ejsResource, timer, kbnIndex, alertSrv, esVersion, esMinVersion
  ) {
    // A hash of defaults to use when loading a dashboard

    var _dash = {
      title: "",
      style: "dark",
      editable: true,
      failover: false,
      panel_hints: true,
      rows: [],
      pulldowns: [
        {
          type: 'query',
        },
        {
          type: 'filtering'
        }
      ],
      nav: [
        {
          type: 'timepicker'
        }
      ],
      services: {},
      loader: {
        save_gist: false,
        save_elasticsearch: true,
        save_local: true,
        save_default: true,
        save_temp: true,
        load_gist: false,
        load_elasticsearch: true,
        load_elasticsearch_size: 20,
        load_local: false,
        hide: false
      },
      index: {
        interval: 'none',
        pattern: '_all',
        default: 'INDEX_MISSING',
        warm_fields: true
      },
      refresh: false
    };

    // An elasticJS client to use
    var ejs = ejsResource(config);

    var gist_pattern = /(^\d{5,}$)|(^[a-z0-9]{10,}$)|(gist.github.com(\/*.*)\/[a-z0-9]{5,}\/*$)/;

    // Store a reference to this
    var self = this;
    var filterSrv,querySrv;

    this.current = _.clone(_dash);
    this.last = {};
    this.availablePanels = [];

    $rootScope.$on('$routeChangeSuccess',function(){
      // Clear the current dashboard to prevent reloading
      self.current = {};
      self.indices = [];
      esVersion.isMinimum().then(function(isMinimum) {
        if(_.isUndefined(isMinimum)) {
          return;
        }
        if(isMinimum) {
          route();
        } else {
          alertSrv.set('Upgrade Required',"Your version of Elasticsearch is too old. Kibana requires" +
            " Elasticsearch " + esMinVersion + " or above.", "error");
        }
      });
    });

    var route = function() {
      // Is there a dashboard type and id in the URL?
      if(!(_.isUndefined($routeParams.kbnType)) && !(_.isUndefined($routeParams.kbnId))) {
        var _type = $routeParams.kbnType;
        var _id = $routeParams.kbnId;

        switch(_type) {
        case ('elasticsearch'):
          self.elasticsearch_load('_doc',_id);
          break;
        case ('temp'):
          self.elasticsearch_load('_doc',_id);
          break;
        case ('file'):
          self.file_load(_id);
          break;
        case('script'):
          self.script_load(_id);
          break;
        case('local'):
          self.local_load();
          break;
        default:
          $location.path(config.default_route);
        }
      // No dashboard in the URL
      } else {
        // Check if browser supports localstorage, and if there's an old dashboard. If there is,
        // inform the user that they should save their dashboard to Elasticsearch and then set that
        // as their default
        if (Modernizr.localstorage) {
          if(!(_.isUndefined(window.localStorage['dashboard'])) && window.localStorage['dashboard'] !== '') {
            $location.path(config.default_route);
            alertSrv.set('Saving to browser storage has been replaced',' with saving to Elasticsearch.'+
              ' Click <a href="#/dashboard/local/deprecated">here</a> to load your old dashboard anyway.');
          } else if(!(_.isUndefined(window.localStorage.kibanaDashboardDefault))) {
            $location.path(window.localStorage.kibanaDashboardDefault);
          } else {
            $location.path(config.default_route);
          }
        // No? Ok, grab the default route, its all we have now
        } else {
          $location.path(config.default_route);
        }
      }
    };

    // Since the dashboard is responsible for index computation, we can compute and assign the indices
    // here before telling the panels to refresh
    this.refresh = function() {
      if(self.current.index.interval !== 'none') {
        if(_.isUndefined(filterSrv)) {
          return;
        }
        if(filterSrv.idsByType('time').length > 0) {
          var _range = filterSrv.timeRange('last');
          kbnIndex.indices(_range.from,_range.to,
            self.current.index.pattern,self.current.index.interval
          ).then(function (p) {
            if(p.length > 0) {
              self.indices = p;
            } else {
              // Option to not failover
              if(self.current.failover) {
                self.indices = [self.current.index.default];
              } else {
                // Do not issue refresh if no indices match. This should be removed when panels
                // properly understand when no indices are present
                alertSrv.set('No results','There were no results because no indices were found that match your'+
                  ' selected time span','info',5000);
                return false;
              }
            }
            // Don't resolve queries until indices are updated
            querySrv.resolve().then(function(){$rootScope.$broadcast('refresh');});
          });
        } else {
          if(self.current.failover) {
            self.indices = [self.current.index.default];
            querySrv.resolve().then(function(){$rootScope.$broadcast('refresh');});
          } else {
            alertSrv.set("No time filter",
              'Timestamped indices are configured without a failover. Waiting for time filter.',
              'info',5000);
          }
        }
      } else {
        self.indices = [self.current.index.default];
        querySrv.resolve().then(function(){$rootScope.$broadcast('refresh');});
      }
    };

    var dash_defaults = function(dashboard) {
      _.defaults(dashboard,_dash);
      _.defaults(dashboard.index,_dash.index);
      _.defaults(dashboard.loader,_dash.loader);
      return _.cloneDeep(dashboard);
    };

    this.dash_load = function(dashboard) {
      // Cancel all timers
      timer.cancel_all();

      // Make sure the dashboard being loaded has everything required
      dashboard = dash_defaults(dashboard);

      // If not using time based indices, use the default index
      if(dashboard.index.interval === 'none') {
        self.indices = [dashboard.index.default];
      }

      // Set the current dashboard
      self.current = _.clone(dashboard);

      // Delay this until we're sure that querySrv and filterSrv are ready
      $timeout(function() {
        // Ok, now that we've setup the current dashboard, we can inject our services
        if(!_.isUndefined(self.current.services.query)) {
          querySrv = $injector.get('querySrv');
          querySrv.init();
        }
        if(!_.isUndefined(self.current.services.filter)) {
          filterSrv = $injector.get('filterSrv');
          filterSrv.init();
        }
      },0).then(function() {
        // Call refresh to calculate the indices and notify the panels that we're ready to roll
        self.refresh();
      });

      if(dashboard.refresh) {
        self.set_interval(dashboard.refresh);
      }

      // Set the available panels for the "Add Panel" drop down
      self.availablePanels = _.difference(config.panel_names,
        _.pluck(_.union(self.current.nav,self.current.pulldowns),'type'));

      // Take out any that we're not allowed to add from the gui.
      self.availablePanels = _.difference(self.availablePanels,config.hidden_panels);

      if(config.enable_webhooks) {
        var identity = "Anonymous";
        if (config.dashboard_view_webhook_url == null) {
          console.error("Error: enable_webhooks is enabled in config.js however no dashboard_view_webhook_url is specified, webhook will not be triggered");
        } else {
          // call the identity provider when present to return the current authenticated user information
          if (config.identity_provider_api_url != null) {
            var info = $http({
              url: config.identity_provider_api_url,
              method: "GET"
            });
            console.log(info);
          }
          // trigger the webhook
          return $http({
            url: config.dashboard_view_webhook_url,
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
            },
            data: {
              "identity": "k3-user",
              "title": self.current.title
            }
          }).then(function(data) {
            return data;
          }, function() {
            return false;
          });
        }
      }
      
      if(config.dashboard_metrics){
        // if config is set to collect dashboard metrics, 
        // increment or add view count, set last viewed to now
        // copy the other fields in the dashboard's document in the kibana index
        var id = self.current.title;
        var type = 'dashboard';
        // we need to get these values from the existing document for this dash
        // this doesn't seem to work how I would expect
        var existingdoc = ejs.getSource(config.kibana_index, type, id).then(
          // Success - set as jsonified document
          function(data) { 
            // data exists here
            //alert(angular.toJson(data));
            return angular.toJson(data); 
          },
          // Failure
          function() { return {}; }
        );
        // data does not exist here
        //alert(existingdoc);
        if(!_.isUndefined(existingdoc)){
          var indexSource = {
            title: self.current.title,
            user: existingdoc.user,
            dashboard: angular.toJson(self.current),
            type: type,
            lastmodifieddate: existingdoc.lastmodifieddate,
            lastvieweddate: new Date().getTime(),
            countofviews: _.isUndefined(existingdoc.countofviews) ? 1 : 1 + existingdoc.countofviews
          };
          // update by id
          ejs.doIndex(config.kibana_index,type,id, indexSource).then(
            // Success
            function() {
              return true;
            },
            // Failure
            function() {
              return false;
            }
          );
        }
      } // end config.dashboard_metrics

      return true;
    };

    this.gist_id = function(string) {
      if(self.is_gist(string)) {
        return string.match(gist_pattern)[0].replace(/.*\//, '');
      }
    };

    this.is_gist = function(string) {
      if(!_.isUndefined(string) && string !== '' && !_.isNull(string.match(gist_pattern))) {
        return string.match(gist_pattern).length > 0 ? true : false;
      } else {
        return false;
      }
    };

    this.to_file = function() {
      var blob = new Blob([angular.toJson(self.current,true)], {type: "application/json;charset=utf-8"});
      // from filesaver.js
      window.saveAs(blob, self.current.title+"-"+new Date().getTime());
      return true;
    };

    this.set_default = function(route) {
      if (Modernizr.localstorage) {
        // Purge any old dashboards
        if(!_.isUndefined(window.localStorage['dashboard'])) {
          delete window.localStorage['dashboard'];
        }
        window.localStorage.kibanaDashboardDefault = route;
        return true;
      } else {
        return false;
      }
    };

    this.purge_default = function() {
      if (Modernizr.localstorage) {
        // Purge any old dashboards
        if(!_.isUndefined(window.localStorage['dashboard'])) {

          delete window.localStorage['dashboard'];
        }
        delete window.localStorage.kibanaDashboardDefault;
        return true;
      } else {
        return false;
      }
    };

    // TOFIX: Pretty sure this breaks when you're on a saved dashboard already
    this.share_link = function(title,type,id) {
      return {
        location  : window.location.href.substr(0, window.location.href.indexOf('#')),
        type      : type,
        id        : id,
        link      : window.location.href.substr(0, window.location.href.indexOf('#'))+"#dashboard/"+type+"/"+encodeURIComponent(id),
        title     : title
      };
    };

    var renderTemplate = function(json,params) {
      var _r;
      _.templateSettings = {interpolate : /\{\{(.+?)\}\}/g};
      var template = _.template(json);
      var rendered = template({ARGS:params});
      try {
        _r = angular.fromJson(rendered);
      } catch(e) {
        _r = false;
      }
      return _r;
    };

    this.local_load = function() {
      var dashboard = JSON.parse(window.localStorage['dashboard']);
      dashboard.rows.unshift({
        height: "30",
        title: "Deprecation Notice",
        panels: [
          {
            title: 'WARNING: Legacy dashboard',
            type: 'text',
            span: 12,
            mode: 'html',
            content: 'This dashboard has been loaded from the browsers local cache. If you use '+
            'another brower or computer you will not be able to access it! '+
            '\n\n  <h4>Good news!</h4> Kibana'+
            ' now stores saved dashboards in Elasticsearch. Click the <i class="icon-save"></i> '+
            'button in the top left to save this dashboard. Then select "Set as Home" from'+
            ' the "advanced" sub menu to automatically use the stored dashboard as your Kibana '+
            'landing page afterwards'+
            '<br><br><strong>Tip:</strong> You may with to remove this row before saving!'
          }
        ]
      });
      self.dash_load(dashboard);
    };

    this.file_load = function(file) {
      return $http({
        url: "app/dashboards/"+file.replace(/\.(?!json)/,"/")+'?' + new Date().getTime(),
        method: "GET",
        transformResponse: function(response) {
          return renderTemplate(response,$routeParams);
        }
      }).then(function(result) {
        if(!result) {
          return false;
        }
        self.dash_load(dash_defaults(result.data));
        return true;
      },function() {
        alertSrv.set('Error',"Could not load <i>dashboards/"+file+"</i>. Please make sure it exists" ,'error');
        return false;
      });
    };

    this.elasticsearch_load = function(type,id) {
      var successcb = function(data) {
        var response = renderTemplate(angular.fromJson(data).dashboard, $routeParams);
        self.dash_load(response);
      };
      var errorcb = function(data, status) {
        if(status === 0) {
          alertSrv.set('Error',"Could not contact Elasticsearch at "+ejs.config.host+
            ". Please ensure that Elasticsearch is reachable from your system." ,'error');
        } else {
          alertSrv.set('Error',"Could not find "+id+". If you"+
            " are using a proxy, ensure it is configured correctly",'error');
        }
        return false;
      };
      ejs.getSource(config.kibana_index, type, id).then(successcb, errorcb);
    };

    this.script_load = function(file) {
      return $http({
        url: "app/dashboards/"+file.replace(/\.(?!js)/,"/"),
        method: "GET",
        transformResponse: function(response) {
          /*jshint -W054 */
          var _f = new Function('ARGS','kbn','_','moment','window','document','angular','require','define','$','jQuery',response);
          return _f($routeParams,kbn,_,moment);
        }
      }).then(function(result) {
        if(!result) {
          return false;
        }
        self.dash_load(dash_defaults(result.data));
        return true;
      },function() {
        alertSrv.set('Error',
          "Could not load <i>scripts/"+file+"</i>. Please make sure it exists and returns a valid dashboard" ,
          'error');
        return false;
      });
    };

    this.elasticsearch_save = function(type,title,user) {
      // Clone object so we can modify it without influencing the existing obejct
      var save = _.clone(self.current);
      var id;

      // do not persist temp filters when saving
      _.each(save.services.filter.list, function(f, idx){
              
        if (f.istemp){
          delete save.services.filter.list[idx];
          // This must happen on the full path also since _.without returns a copy
          save.services.filter.ids = save.services.filter.ids = _.without(save.services.filter.ids,f.id);
        }
      });

      // Change title on object clone
      if (type === 'dashboard') {
        id = save.title = _.isUndefined(title) ? self.current.title : title;
      }

      var indexSource = {};

      if(config.dashboard_metrics){
        var existingdoc = ejs.getSource(config.kibana_index, type, id).then(
          // Success - return jsonified document
          function(data) { return angular.toJson(data); },
          // Failure
          function() { return false; }
        );
        var lastvieweddate = new Date().getTime();  
        var countofviews = 1;
        if(!_.isUndefined(existingdoc)){
          // if it exists, we're saving a change to the current dash, so do not increment
          lastvieweddate = _.isUndefined(existingdoc.lastvieweddate) ? new Date().getTime() : existingdoc.lastvieweddate;
          countofviews = _.isUndefined(existingdoc.countofviews) ? 1 : existingdoc.countofviews;
        }
  
        // Create request with id as title. Rethink this.
        indexSource = {
          title: save.title,
          user: _.isUndefined(user) ? null : user,
          dashboard: angular.toJson(save),
          type: type,
          lastmodifieddate: new Date().getTime(),
          lastvieweddate: lastvieweddate,
          countofviews: countofviews
        };
        // end config.dashboard_metrics
      } else {  
        // Create request with id as title. Rethink this.
        indexSource = {
          title: save.title,
          user: _.isUndefined(user) ? null : user,
          dashboard: angular.toJson(save),
          type: type,
          lastmodifieddate: new Date().getTime()
        };
      }

      return ejs.doIndex(config.kibana_index,'dashboard',id, indexSource).then(
        // Success
        function(result) {
          if(type === 'dashboard') {
            $location.path('/dashboard/elasticsearch/'+title);
          }
          return result;
        },
        // Failure
        function() {
          return false;
        }
      );
    };

    this.elasticsearch_delete = function(id) {
      return ejs.doDelete(config.kibana_index,'dashboard',id).then(
        // Success
        function(result) {
          return result;
        },
        // Failure
        function() {
          return false;
        }
      );
    };

    this.elasticsearch_list = function(query,count) {
      var request = ejs.Request();

      var ejsQuery = ejs.BoolQuery();
      if(query) {
        ejsQuery = ejsQuery.must(ejs.QueryStringQuery(query).defaultField('title'));
      }
      ejsQuery = ejsQuery.must(ejs.MatchQuery('type', 'dashboard'));

      request = request.query(ejsQuery);

      return ejs.doSearch(config.kibana_index, request, count).then(
          // Success
          function(result) {
            return result;
          },
          // Failure
          function() {
            return false;
          }
        );
    };

    this.save_gist = function(title,dashboard) {
      var save = _.clone(dashboard || self.current);
      save.title = title || self.current.title;
      return $http({
        url: "https://api.github.com/gists",
        method: "POST",
        data: {
          "description": save.title,
          "public": false,
          "files": {
            "kibana-dashboard.json": {
              "content": angular.toJson(save,true)
            }
          }
        }
      }).then(function(data) {
        return data.data.html_url;
      }, function() {
        return false;
      });
    };

    this.gist_list = function(id) {
      return $http.jsonp("https://api.github.com/gists/"+id+"?callback=JSON_CALLBACK"
      ).then(function(response) {
        var files = [];
        _.each(response.data.data.files,function(v) {
          try {
            var file = JSON.parse(v.content);
            files.push(file);
          } catch(e) {
            return false;
          }
        });
        return files;
      }, function() {
        return false;
      });
    };

    this.start_scheduled_refresh = function (after_ms) {
      timer.cancel(self.refresh_timer);
      self.refresh_timer = timer.register($timeout(function () {
        self.start_scheduled_refresh(after_ms);
        self.refresh();
      }, after_ms));
    };

    this.cancel_scheduled_refresh = function () {
      timer.cancel(self.refresh_timer);
    };

    this.set_interval = function (interval) {
      self.current.refresh = interval;
      if (interval) {
        var _i = kbn.interval_to_ms(interval);
        this.start_scheduled_refresh(_i);
      } else {
        this.cancel_scheduled_refresh();
      }
    };


  });

});
