define([
  'angular',
  'lodash',
  'config',
  'kbn'
],
function (angular, _, config, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('querySrv', function(dashboard, ejsResource, filterSrv, esVersion, $q) {

    // Save a reference to this
    var self = this;

    // Create an object to hold our service state on the dashboard
    dashboard.current.services.query = dashboard.current.services.query || {};
    _.defaults(dashboard.current.services.query,{
      list : {},
      ids : [],
    });

    // this.colors = [
    //   "#7EB26D","#EAB839","#6ED0E0","#EF843C","#E24D42","#1F78C1","#BA43A9","#705DA0", //1
    //   "#508642","#CCA300","#447EBC","#C15C17","#890F02","#0A437C","#6D1F62","#584477", //2
    //   "#B7DBAB","#F4D598","#70DBED","#F9BA8F","#F29191","#82B5D8","#E5A8E2","#AEA2E0", //3
    //   "#629E51","#E5AC0E","#64B0C8","#E0752D","#BF1B00","#0A50A1","#962D82","#614D93", //4
    //   "#9AC48A","#F2C96D","#65C5DB","#F9934E","#EA6460","#5195CE","#D683CE","#806EB7", //5
    //   "#3F6833","#967302","#2F575E","#99440A","#58140C","#052B51","#511749","#3F2B5B", //6
    //   "#E0F9D7","#FCEACA","#CFFAFF","#F9E2D2","#FCE2DE","#BADFF4","#F9D9F9","#DEDAF7"  //7
    // ];
    this.colors = [
      "#0257bc", "#25b960", "#012337", "#a2e481", "#82b8e3", "#cc074c", "#13a37a",  // Core colors
      "#1b68c3", "#3bc070", "#1a394b", "#abe78e", "#8ebfe6", "#d1205e", "#2bac87",  // Slightly lighter
      "#3075c8", "#4cc67d", "#2f4b5b", "#b3e998", "#98c5e8", "#d5346c", "#3db492",  // Lighter
      "#4483cd", "#5ecb89", "#435c6b", "#baeba2", "#a2caea", "#d9477b", "#50bb9d",  // Even lighter
      "#5890d3", "#6fd196", "#576e7b", "#c2edac", "#acd0ed", "#dd5b89", "#63c2a7",  // Lighter still
      "#6c9ed8", "#81d6a3", "#6c7f8b", "#c9efb6", "#b6d6ef", "#e16f97", "#76cab2",  // More lightened
      "#80abde", "#92dcb0", "#80919b", "#d0f2c0", "#c0dcf1", "#e683a5", "#89d1bc"   // Lightest variant
    ];

    // For convenience
    var ejs = ejsResource(config);

    // Holds all actual queries, including all resolved abstract queries
    var resolvedQueries = [];

    // Defaults for generic query object
    var _query = {
      alias: '',
      pin: false,
      type: 'lucene',
      enable: true
    };

    // Defaults for specific query types
    var _dTypes = {
      "lucene": {
        query: "*"
      },
      "regex": {
        query: ".*"
      },
      "topN": {
        query: "*",
        field: "_index",
        size: 5,
        union: 'AND'
      }
    };

    var nextId = function() {
      var idCount = dashboard.current.services.query.ids.length;
      if(idCount > 0) {
        // Make a sorted copy of the ids array
        var ids = _.sortBy(_.clone(dashboard.current.services.query.ids),function(num){
          return num;
        });
        return kbn.smallestMissing(ids);
      } else {
        // No ids currently in list
        return 0;
      }
    };

    var colorAt = function(id) {
      return self.colors[id % self.colors.length];
    };

    // query type meta data that is not stored on the dashboard object
    this.queryTypes = {
      lucene: {
        require:">=0.17.0",
        icon: "icon-circle",
        resolve: function(query) {
          // Simply returns itself
          var p = $q.defer();
          p.resolve(_.extend(query,{parent:query.id}));
          return p.promise;
        }
      },
      // regex: {
      //   require:">=0.90.12",
      //   icon: "icon-circle",
      //   resolve: function(query) {
      //     // Simply returns itself
      //     var p = $q.defer();
      //     p.resolve(_.extend(query,{parent:query.id}));
      //     return p.promise;
      //   }
      // },
      topN : {
        require:">=0.90.3",
        icon: "icon-cog",
        resolve: function(q) {
          var suffix = '';
          if (q.union === 'AND') {
            suffix = ' AND (' + (q.query||'*') + ')';
          } else if (q.union === 'OR') {
            suffix = ' OR (' + (q.query||'*') + ')';
          }

          var request = ejs.Request();

          var query = filterSrv.getBoolQuery(filterSrv.ids());
          query.must(ejs.QueryStringQuery(q.query || '*'));

          var terms_aggs = ejs.TermsAggregation('terms')
            .field(q.field)
            .size(q.size);

          request = request.query(query).agg(terms_aggs).size(0);
          var results = ejs.doSearch(dashboard.indices, request);

          // Like the regex and lucene queries, this returns a promise
          return results.then(function(data) {
            var _colors = kbn.colorSteps(q.color,data.aggregations.terms.buckets.length);
            var i = -1;
            return _.map(data.aggregations.terms.buckets,function(t) {
              ++i;
              return self.defaults({
                query  : q.field+':"'+kbn.addslashes('' + t.key)+'"'+suffix,
                alias  : t.key + (q.alias ? " ("+q.alias+")" : ""),
                type   : 'lucene',
                color  : _colors[i],
                parent : q.id
              });
            });
          });
        }
      }
    };

    self.types = [];
    _.each(self.queryTypes,function(type,name){
      esVersion.is(type.require).then(function(is) {
        if(is) {
          self.types.push(name);
        }
      });
    });


    this.list = function () {
      return dashboard.current.services.query.list;
    };

    this.ids = function () {
      return dashboard.current.services.query.ids;
    };

    this.init = function() {

      dashboard.current.services.query.ids =
        _.intersection(_.map(dashboard.current.services.query.list,
          function(v,k){return parseInt(k,10);}),self.ids());

      // Check each query object, populate its defaults
      _.each(dashboard.current.services.query.list,function(query) {
        query = self.defaults(query);
      });

      if (dashboard.current.services.query.ids.length === 0) {
        self.set({});
      }
    };

    // This is used both for adding queries and modifying them. If an id is passed,
    // the query at that id is updated
    this.set = function(query,id) {
      if(!_.isUndefined(id)) {
        if(!_.isUndefined(dashboard.current.services.query.list[id])) {
          _.extend(dashboard.current.services.query.list[id],query);
          return id;
        } else {
          return false;
        }
      } else {
        // Query must have an id and color already
        query.id = _.isUndefined(query.id) ? nextId() : query.id;
        query.color = query.color || colorAt(query.id);
        // Then it can get defaults
        query = self.defaults(query);
        dashboard.current.services.query.list[query.id] = query;
        dashboard.current.services.query.ids.push(query.id);
        return query.id;
      }
    };

    this.defaults = function(query) {
      _.defaults(query,_query);
      _.defaults(query,_dTypes[query.type]);
      query.color = query.color || colorAt(query.id);
      return query;
    };

    this.remove = function(id) {
      if(!_.isUndefined(dashboard.current.services.query.list[id])) {
        delete dashboard.current.services.query.list[id];
        // This must happen on the full path also since _.without returns a copy
        dashboard.current.services.query.ids = _.without(dashboard.current.services.query.ids,id);
        return true;
      } else {
        return false;
      }
    };


    // These are the only query types that can be returned by a compound query.
    this.toEjsObj = function (q) {
      switch(q.type)
      {
      case 'lucene':
        var luceneQuery = ejs.QueryStringQuery(q.query || '*');
        return luceneQuery;
      case 'regex':
        return ejs.RegexpQuery('_all',q.query);
      default:
        return false;
      }
    };

    //
    this.getQueryObjs = function(ids) {
      if(_.isUndefined(ids)) {
        return resolvedQueries;
      } else {
        return _.flatten(_.map(ids,function(id) {
          return _.where(resolvedQueries,{parent:id});
        }));
      }
    };

    // BROKEN
    this.idsByMode = function(config) {
      switch(config.mode)
      {
      case 'all':
        return _.pluck(_.where(dashboard.current.services.query.list,{enable:true}),'id');
      case 'pinned':
        return _.pluck(_.where(dashboard.current.services.query.list,{pin:true,enable:true}),'id');
      case 'unpinned':
        return _.pluck(_.where(dashboard.current.services.query.list,{pin:false,enable:true}),'id');
      case 'selected':
        return _.intersection(_.pluck(_.where(dashboard.current.services.query.list,{enable:true}),'id'),config.ids);
      default:
        return _.pluck(_.where(dashboard.current.services.query.list,{enable:true}),'id');
      }
    };

    // This populates the internal query list and returns a promise containing it
    this.resolve = function() {
      // Find ids of all abstract queries
      // Get a list of resolvable ids, constrast with total list to get abstract ones
      return $q.all(_.map(dashboard.current.services.query.ids,function(q) {
        return self.queryTypes[dashboard.current.services.query.list[q].type].resolve(
          _.clone(dashboard.current.services.query.list[q])).then(function(data){
          return data;
        });
      })).then(function(data) {
        resolvedQueries = _.flatten(data);
        _.each(resolvedQueries,function(q,i) {
          q.id = i;
        });
        return resolvedQueries;
      });
    };

    self.init();
  });

});
