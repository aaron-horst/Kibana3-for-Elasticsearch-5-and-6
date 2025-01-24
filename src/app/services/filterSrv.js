define([
  'angular',
  'lodash',
  'config',
  'kbn'
], function (angular, _, config, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('filterSrv', function(dashboard, ejsResource, $rootScope, $timeout, $window) {
    // Create an object to hold our service state on the dashboard
    dashboard.current.services.filter = dashboard.current.services.filter || {};

    // Defaults for it
    var _d = {
      list : {},
      ids : []
    };

    // For convenience
    var ejs = ejsResource(config);

    // Save a reference to this
    var self = this;

    // local fn to handle parsing of query string params
    function parseDashboardFilters(fullQueryString) {

      var resultObj = { hasFilters: false };
  
      if (!fullQueryString) { 
        return resultObj;
      }
  
      // make sure query string does not contain any encoded characters
      fullQueryString = decodeURIComponent(fullQueryString);
  
      var filters = fullQueryString.substring(1)  // remove leading ?
          .split('=')[1]                          // remove query string sub key ('filters=')
          .replace('params:', '')                 // remove leading identifier
          .replace('),(', ') , (').split(' , ');  // expand item delimeter and split
  
      if (filters.length === 0) {
        return resultObj;
      }
  
      resultObj.hasFilters = true;
      resultObj.queryValue = fullQueryString.substring(1);
      resultObj.filters = [];
  
      for (var i = 0; i < filters.length; i++) {
        var item = filters[i];

        var rawQuery = item.substring(0, item.length - 1).replace('(query:', '');

        var queryParts = rawQuery.split(',');

        // grab the last itme in the array split on commans for the query type in case the actual query contains a comma
        var queryType = queryParts[queryParts.length - 1];

        // remove the query type segement from the raw query
        var itemQuery = rawQuery.replace(',' + queryType, '');

        var mandate = queryType.replace('type:', '');
        var field = itemQuery.split(':')[0];
        var query = itemQuery.split(':')[1];
          
        resultObj.filters.push({
            //id: nextId(),
            alias: "",
            active: true,
            field: field,
            query: query.replace('\'', '"').replace('\'', '"'), // hacky way of ensuring " instead of '
            type: 'field',
            mandate: mandate,
            istemp: true
          });
      }
  
      return resultObj;
    }

    // Call this whenever we need to reload the important stuff
    this.init = function() {
      // Populate defaults
      _.defaults(dashboard.current.services.filter,_d);

      _.each(dashboard.current.services.filter.list,function(f) {
        self.set(f,f.id,true);
      });

      // add filters from query string if needed
      if (dashboard.current.services.filter.list[0] && $window.location.search){
        
        var qsFilterCheckResult = parseDashboardFilters($window.location.search);
        if (qsFilterCheckResult.hasFilters){
          
          _.each(qsFilterCheckResult.filters,function(fi) {
            self.set(fi,fi.id,false);
          });
        }
      }
    };

    this.ids = function() {
      return dashboard.current.services.filter.ids;
    };

    this.list = function() {
      return dashboard.current.services.filter.list;
    };

    // This is used both for adding filters and modifying them.
    // If an id is passed, the filter at that id is updated
    this.set = function(filter,id,noRefresh) {
      var _r;

      _.defaults(filter,{
        mandate:'must',
        active: true
      });

      if(!_.isUndefined(id)) {
        if(!_.isUndefined(dashboard.current.services.filter.list[id])) {
          _.extend(dashboard.current.services.filter.list[id],filter);
          _r = id;
        } else {
          _r = false;
        }
      } else {
        if(_.isUndefined(filter.type)) {
          _r = false;
        } else {
          var _id = nextId();
          var _filter = {
            alias: '',
            id: _id,
            mandate: 'must'
          };
          _.defaults(filter,_filter);
          dashboard.current.services.filter.list[_id] = filter;
          dashboard.current.services.filter.ids.push(_id);
          _r = _id;
        }
      }
      if(!$rootScope.$$phase) {
        $rootScope.$apply();
      }
      if(noRefresh !== true) {
        $timeout(function(){
          dashboard.refresh();
        },0);
      }
      dashboard.current.services.filter.ids = dashboard.current.services.filter.ids =
        _.intersection(_.map(dashboard.current.services.filter.list,
          function(v,k){return parseInt(k,10);}),dashboard.current.services.filter.ids);
      $rootScope.$broadcast('filter');

      return _r;
    };

    this.remove = function(id,noRefresh) {
      var _r;
      if(!_.isUndefined(dashboard.current.services.filter.list[id])) {
        delete dashboard.current.services.filter.list[id];
        // This must happen on the full path also since _.without returns a copy
        dashboard.current.services.filter.ids = dashboard.current.services.filter.ids = _.without(dashboard.current.services.filter.ids,id);
        _r = true;
      } else {
        _r = false;
      }
      if(!$rootScope.$$phase) {
        $rootScope.$apply();
      }
      if(noRefresh !== true) {
        $timeout(function(){
          dashboard.refresh();
        },0);
      }
      $rootScope.$broadcast('filter');
      return _r;
    };

    this.removeByType = function(type,noRefresh) {
      var ids = self.idsByType(type);
      _.each(ids,function(id) {
        self.remove(id,true);
      });
      if(noRefresh !== true) {
        $timeout(function(){
          dashboard.refresh();
        },0);
      }
      return ids;
    };

    this.getBoolQuery = function(ids) {
      var bool = ejs.BoolQuery();
      // there is no way to introspect the BoolQuery and find out if it has an applied filter. We must keep note.
      var added_a_filter = false;

      _.each(ids,function(id) {
        if(dashboard.current.services.filter.list[id].active) {
          added_a_filter = true;

          switch(dashboard.current.services.filter.list[id].mandate)
          {
          case 'mustNot':
            bool.mustNot(self.getEjsQuery(id));
            break;
          case 'either':
            bool.should(self.getEjsQuery(id));
            break;
          default:
            bool.must(self.getEjsQuery(id));
          }
        }
      });
      // add a match all query so we'd get some data
      if (!added_a_filter) {
        bool.must(ejs.MatchAllQuery());
      }
      return bool;
    };

    this.getEjsQuery = function(id) {
      return self.toEjsQueryObj(dashboard.current.services.filter.list[id]);
    };

    this.toEjsQueryObj = function (filter) {
      if(!filter.active) {
        return false;
      }

      switch(filter.type)
      {
      case 'time':
        var _f = ejs.RangeQuery(filter.field).from(kbn.parseDate(filter.from).valueOf());
        if(!_.isUndefined(filter.to)) {
          _f = _f.to(kbn.parseDate(filter.to).valueOf());
        }
        return _f;
      case 'range':
        return ejs.RangeQuery(filter.field)
          .from(filter.from)
          .to(filter.to);
      case 'querystring':
        return ejs.QueryStringQuery(filter.query);
      case 'field':
        return ejs.QueryStringQuery(filter.field+":("+filter.query+")");
      case 'terms':
        return ejs.TermsQuery(filter.field,filter.value);
      case 'exists':
        return ejs.ExistsQuery(filter.field);
      case 'missing':
        var _b = ejs.BoolQuery();
        _b.mustNot(ejs.ExistsQuery(filter.field));
        return _b;
      default:
        return false;
      }
    };


    this.getByType = function(type,inactive) {
      return _.pick(dashboard.current.services.filter.list,self.idsByType(type,inactive));
    };

    this.idsByType = function(type,inactive) {
      var _require = inactive ? {type:type} : {type:type,active:true};
      return _.pluck(_.where(dashboard.current.services.filter.list,_require),'id');
    };

    // TOFIX: Error handling when there is more than one field
    this.timeField = function() {
      return _.pluck(self.getByType('time'),'field');
    };

    // Parse is used when you need to know about the raw filter
    this.timeRange = function(parse) {
      var _t = _.last(_.where(dashboard.current.services.filter.list,{type:'time',active:true}));
      if(_.isUndefined(_t)) {
        return false;
      }
      if(parse === false) {
        return {
          from: _t.from,
          to: _t.to
        };
      } else {
        var
          _from = _t.from,
          _to = _t.to || new Date();

        return {
          from : kbn.parseDate(_from),
          to : kbn.parseDate(_to)
        };
      }
    };

    var nextId = function() {
      var idCount = dashboard.current.services.filter.ids.length;
      if(idCount > 0) {
        // Make a sorted copy of the ids array
        var ids = _.sortBy(_.clone(dashboard.current.services.filter.ids),function(num){
          return num;
        });
        return kbn.smallestMissing(ids);
      } else {
        // No ids currently in list
        return 0;
      }
    };

    // Now init
    self.init();
  });

});
