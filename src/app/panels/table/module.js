/** @scratch /panels/5
 *
 * include::panels/table.asciidoc[]
 */

/** @scratch /panels/table/0
 *
 * == table
 * Status: *Stable*
 *
 * The table panel contains a sortable, pagable view of documents that. It can be arranged into
 * defined columns and offers several interactions, such as performing adhoc terms aggregations.
 *
 */
define([
  'angular',
  'app',
  'lodash',
  'kbn',
  'moment',
  'config',
  'jsonpath',
  'filesaver',
  'blob'
],
function (angular, app, _, kbn, moment, config) {
  'use strict';

  var module = angular.module('kibana.panels.table', []);
  app.useModule(module);

  module.controller('table', function($rootScope, $scope, $modal, $q, $compile, $timeout,
    fields, querySrv, dashboard, filterSrv) {
    $scope.panelMeta = {
      modals : [
        {
          description: "Export",
          icon: "icon-download-alt",
          partial: "app/panels/table/export.html",
          show: $scope.panel.exportable
        },
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      editorTabs : [
        {
          title:'Paging',
          src: 'app/panels/table/pagination.html'
        },
        {
          title:'Color',
          src: 'app/panels/table/color.html'
        },
        {
          title:'Queries',
          src: 'app/partials/querySelect.html'
        }
      ],
      status: "Stable",
      description: "A paginated table of records matching your query or queries. Click on a row to "+
        "expand it and review all of the fields associated with that document. <p>"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/table/5
       * === Parameters
       *
       * size:: The number of hits to show per page
       */
      size    : 100, // Per page
      /** @scratch /panels/table/5
       * pages:: The number of pages available
       */
      pages   : 5,   // Pages available
      /** @scratch /panels/table/5
       * offset:: The current page
       */
      offset  : 0,
      /** @scratch /panels/table/5
       * sort:: An array describing the sort order of the table. For example [`@timestamp',`desc']
       */
      sort    : ['_score','desc'],
      /** @scratch /panels/table/5
       * overflow:: The css overflow property. `min-height' (expand) or `auto' (scroll)
       */
      overflow: 'min-height',
      /** @scratch /panels/table/5
       * fields:: the fields used a columns of the table, in an array.
       */
      fields  : [],
      /** @scratch /panels/table/5
       * highlight:: The fields on which to highlight, in an array
       */
      highlight : [],
      /** @scratch /panels/table/5
       * sortable:: Set sortable to false to disable sorting
       */
      sortable: true,
      /** @scratch /panels/table/5
       * header:: Set to false to hide the table column names
       */
      header  : true,
      /** @scratch /panels/table/5
       * paging:: Set to false to hide the paging controls of the table
       */
      paging  : true,
      /** @scratch /panels/table/5
       * field_list:: Set to false to hide the list of fields. The user will be able to expand it,
       * but it will be hidden by default
       */
      field_list: true,
      /** @scratch /panels/table/5
       * all_fields:: Set to true to show all fields in the mapping, not just the current fields in
       * the table.
       */
      all_fields: false,
      /** @scratch /panels/table/5
       * trimFactor:: The trim factor is the length at which to truncate fields takinging into
       * consideration the number of columns in the table. For example, a trimFactor of 100, with 5
       * columns in the table, would trim each column at 20 character. The entirety of the field is
       * still available in the expanded view of the event.
       */
      trimFactor: 300,
      /** @scratch /panels/table/5
       * localTime:: Set to true to adjust the timeField to the browser's local time
       */
      localTime: false,
      /** @scratch /panels/table/5
       * timeField:: If localTime is set to true, this field will be adjusted to the browsers local time
       */
      timeField: '@timestamp',
      /** @scratch /panels/table/5
       * colorRules:: filed, value(RegExp), color
       */
      colorRules: [],
      /** @scratch /panels/table/5
       * spyable:: Set to false to disable the inspect icon
       */
      spyable : true,
      /** @scratch /panels/table/5
       * exportable:: Set to false to disable the export icon
       */
      exportable : true,
      /** @scratch /panels/table/5
       *
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
      style   : {'font-size': '9pt'},
      normTimes : true,
    };
    _.defaults($scope.panel,_d);

    $scope.init = function () {
      $scope.columns = {};
      _.each($scope.panel.fields,function(field) {
        $scope.columns[field] = true;
      });

      $scope.Math = Math;
      $scope.identity = angular.identity;
      $scope.$on('refresh',function(){$scope.get_data();});

      $scope.fields = fields;
      $scope.get_data();
    };

    // Create a percent function for the view
    $scope.percent = kbn.to_percent;

    $scope.csv = {
      showOptions: false,
      separator: ',',
      quoteValues: true,
      filename: 'table.csv'
    };
    $scope.exportAsCsv = function() {
      if (!$scope.data) {
        return;
      }

      var nonAlphaNumRE = /[^a-zA-Z0-9]/;
      var allDoubleQuoteRE = /"/g;
      var escape = function (val) {
        val = String(val);
        if ($scope.csv.quoteValues && nonAlphaNumRE.test(val)) {
          val = '"' + val.replace(allDoubleQuoteRE, '""') + '"';
        }
        return val;
      };

      var rows = _.map($scope.data, function(e) {
        var exportFields = [];
        _.each($scope.panel.fields, function(field) {
          exportFields.push(escape(e._source[field]));
        });
        return exportFields.join($scope.csv.separator) + '\r\n';
      });

      var blob = new Blob(rows, { type: 'text/plain' });

      window.saveAs(blob, $scope.csv.filename);
    };

    $scope.closeFacet = function() {
      if($scope.modalField) {
        delete $scope.modalField;
      }
    };

    $scope.termsModal = function(field,chart) {
      $scope.closeFacet();
      $timeout(function() {
        $scope.modalField = field;
        $scope.adhocOpts = {
          height: "200px",
          chart: chart,
          field: field,
          span: $scope.panel.span,
          type: 'terms',
          title: 'Top 10 terms in field ' + field
        };
        showModal(
          angular.toJson($scope.adhocOpts),'terms');
      },0);
    };

    $scope.statsModal = function(field) {
      $scope.closeFacet();
      $timeout(function() {
        $scope.modalField = field;
        $scope.adhocOpts = {
          height: "200px",
          field: field,
          mode: 'mean',
          span: $scope.panel.span,
          type: 'stats',
          title: 'Statistics for ' + field
        };
        showModal(
          angular.toJson($scope.adhocOpts),'stats');
      },0);
    };

    $scope.getStyle = function(event){
      var backgroundColor = getBackgroundColor(event);
      if(backgroundColor){
        return {'background-color': backgroundColor};
      }
    };

    var getBackgroundColor = function(event){
      var i, len, cr, data;

      for(i=0, len=$scope.panel.colorRules.length; i<len; i++){
        cr = $scope.panel.colorRules[i];
        if(cr.field != '_index' && cr.field != '_id' && cr.field != '_score'){
          data = event._source;
        } else{
          data = event;
        }
        if(data[cr.field] && data[cr.field].match(new RegExp(cr.value))){
          return cr.color;
        }
      }
    };

    var showModal = function(panel,type) {
      $scope.facetPanel = panel;
      $scope.facetType = type;
    };

    $scope.toggle_micropanel = function(field,groups) {
      var docs = _.map($scope.data,function(_d){return _d.kibana._source;});
      var topFieldValues = kbn.top_field_values(docs,field,10,groups);
      $scope.micropanel = {
        field: field,
        grouped: groups,
        values : topFieldValues.counts,
        hasArrays : topFieldValues.hasArrays,
        related : kbn.get_related_fields(docs,field),
        limit: 10,
        count: _.countBy(docs,function(doc){return _.contains(_.keys(doc),field);})['true']
      };


      var nodeInfo = $scope.ejs.getFieldMapping(dashboard.indices, field);

      return nodeInfo.then(function(p) {
        var types = _.uniq(jsonPath(p, '*.*.*.*.mapping.*.type'));
        if (_.isArray(types)) {
          $scope.micropanel.type = types.join(', ');
        }


        if(_.intersection(types, ['long','float','integer','double']).length > 0) {
          $scope.micropanel.hasStats =  true;
        }
      });

    };

    $scope.micropanelColor = function(index) {
      var _c = ['bar-success','bar-warning','bar-danger','bar-info','bar-primary'];
      return index > _c.length ? '' : _c[index];
    };

    $scope.set_sort = function(field) {

      var nodeInfo = $scope.ejs.getFieldMapping(dashboard.indices, field);

      return nodeInfo.then(function(p) {
        var types = _.uniq(jsonPath(p, '*.*.*.*.mapping.*.type'));
        var indices = _.uniq(jsonPath(p, '*.*.*.*.mapping.*.index'));

        if(_.intersection(types, ['string']).length > 0 && _.intersection(indices, ['not_analyzed']).length != 1) {
          $scope.panel.error = "could not sort by an analyzed field;";
          return;
        }
        else{
          if($scope.panel.sort[0] === field) {
            $scope.panel.sort[1] = $scope.panel.sort[1] === 'asc' ? 'desc' : 'asc';
          } else {
            $scope.panel.sort[0] = field;
          }
          $scope.get_data();
        }
      });
    };

    $scope.toggle_field = function(field) {
      if (_.indexOf($scope.panel.fields,field) > -1) {
        $scope.panel.fields = _.without($scope.panel.fields,field);
        delete $scope.columns[field];
      } else {
        $scope.panel.fields.push(field);
        $scope.columns[field] = true;
      }
    };

    $scope.toggle_highlight = function(field) {
      if (_.indexOf($scope.panel.highlight,field) > -1) {
        $scope.panel.highlight = _.without($scope.panel.highlight,field);
      } else {
        $scope.panel.highlight.push(field);
      }
    };

    $scope.toggle_details = function(row) {
      row.kibana.details = row.kibana.details ? false : true;
      row.kibana.view = row.kibana.view || 'table';
      //row.kibana.details = !row.kibana.details ? $scope.without_kibana(row) : false;
    };

    $scope.page = function(page) {
      $scope.panel.offset = page*$scope.panel.size;
      $scope.get_data();
    };

    $scope.build_search = function(field,value,negate) {
      var query;
      // This needs to be abstracted somewhere
      if(_.isArray(value)) {
        query = "(" + _.map(value,function(v){return angular.toJson(v);}).join(" AND ") + ")";
      } else if (_.isUndefined(value)) {
        query = '*';
        negate = !negate;
      } else {
        query = angular.toJson(value);
      }
      $scope.panel.offset = 0;

      const q = field + ":(" + query + ")";
      filterSrv.set({
        editing   : false,
        type      : 'querystring',
        query     : q,
        mandate   : (negate ? 'mustNot' : 'must')
      },undefined,false);
    };

    $scope.fieldExists = function(field,mandate) {
      filterSrv.set({type:'exists',field:field,mandate:mandate});
    };

    $scope.get_data = function(segment,query_id) {
      var
        _segment,
        request,
        boolQuery,
        queries,
        sort;

      $scope.panel.error =  false;

      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }

      sort = [$scope.ejs.Sort($scope.panel.sort[0]).order($scope.panel.sort[1])];
      if($scope.panel.localTime) {
        sort.push($scope.ejs.Sort($scope.panel.timeField).order($scope.panel.sort[1]));
      }


      $scope.panelMeta.loading = true;

      _segment = _.isUndefined(segment) ? 0 : segment;
      $scope.segment = _segment;

      request = $scope.ejs.Request();

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);

      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // Construct base bool query 
      boolQuery = filterSrv.getBoolQuery(filterSrv.ids());
      var _b = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        _b = _b.should(querySrv.toEjsObj(q));
      });
      boolQuery = boolQuery.must(_b);

      request = request.query(boolQuery).highlight(
          $scope.ejs.Highlight($scope.panel.highlight)
          .fragmentSize(2147483647) // Max size of a 32bit unsigned int
          .preTags('@start-highlight@')
          .postTags('@end-highlight@')
        )
        .size($scope.panel.size*$scope.panel.pages)
        .sort(sort);

      $scope.populate_modal(request);

      // Populate scope when we have results
      $scope.ejs.doSearch(dashboard.indices[_segment], request, $scope.panel.size*$scope.panel.pages).then(function(results) {
        $scope.panelMeta.loading = false;

        if(_segment === 0) {
          $scope.panel.offset = 0;
          $scope.hits = 0;
          $scope.data = [];
          $scope.current_fields = [];
          query_id = $scope.query_id = new Date().getTime();
        }

        // Check for error and abort if found
        if(!(_.isUndefined(results.error))) {
          $scope.panel.error = $scope.parse_error(results.error);
          return;
        }

        // Check that we're still on the same query, if not stop
        if($scope.query_id === query_id) {

          // This is exceptionally expensive, especially on events with a large number of fields
          $scope.data = $scope.data.concat(_.map(results.hits.hits, function(hit) {
            var
              _h = _.clone(hit),
              _p = _.omit(hit,'_source','sort','_score');

            // _source is kind of a lie here, never display it, only select values from it
            _h.kibana = {
              _source : _.extend(kbn.flatten_json(hit._source),_p),
              highlight : kbn.flatten_json(hit.highlight||{})
            };

            // Kind of cheating with the _.map here, but this is faster than kbn.get_all_fields
            $scope.current_fields = $scope.current_fields.concat(_.keys(_h.kibana._source));

            return _h;
          }));

          $scope.current_fields = _.uniq($scope.current_fields);
          $scope.hits += results.hits.total;

          // Sort the data
          $scope.data = _.sortBy($scope.data, function(v){
            if(!_.isUndefined(v.sort)) {
              return v.sort[0];
            } else {
              return v._score;
            }
          });

          // Reverse if needed
          if($scope.panel.sort[1] === 'desc') {
            $scope.data.reverse();
          }

          // Keep only what we need for the set
          $scope.data = $scope.data.slice(0,$scope.panel.size * $scope.panel.pages);

        } else {
          return;
        }

        // If we're not sorting in reverse chrono order, query every index for
        // size*pages results
        // Otherwise, only get size*pages results then stop querying
        if (($scope.data.length < $scope.panel.size*$scope.panel.pages ||
          !((_.contains(filterSrv.timeField(),$scope.panel.sort[0])) && $scope.panel.sort[1] === 'desc')) &&
          _segment+1 < dashboard.indices.length) {
          $scope.get_data(_segment+1,$scope.query_id);
        }

      });
    };

    $scope.populate_modal = function(request) {
      $scope.inspector = request.toJSON();
    };

    $scope.without_kibana = function (row) {
      var _c = _.clone(row);
      delete _c.kibana;
      return _c;
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.columns = [];
      _.each($scope.panel.fields,function(field) {
        $scope.columns[field] = true;
      });
      $scope.refresh =  false;
    };

    $scope.locate = function(obj, path) {
      path = path.split('.');
      var arrayPattern = /(.+)\[(\d+)\]/;
      for (var i = 0; i < path.length; i++) {
        var match = arrayPattern.exec(path[i]);
        if (match) {
          obj = obj[match[1]][parseInt(match[2],10)];
        } else {
          obj = obj[path[i]];
        }
      }
      return obj;
    };

    $scope.getDynamicUrl = function(field, row) {
      // Find the hyperlink rules for the given field
      const rules = config.hyperlinked_fields_doclevel.find(hf => hf.fieldName === field);
      if (!rules) return null; // If no rules found, return null
    
      // Extract token values directly from the row object
      const tokens = rules.tokens.map(token => row[token] || ''); // Use the token as the key
    
      // Replace the {0}, {1}, etc., in the URL template with token values
      const newUrl = rules.urlTemplate.replace(/{(\d+)}/g, (_, index) => tokens[index] || '');
      return newUrl;
    };
    
    $scope.isLinkable = function(field) {
      // var retval = config.hyperlinked_fields_doclevel.some(hf => hf.fieldName === field);
      const rules = config.hyperlinked_fields_doclevel.find(hf => hf.fieldName === field);
      if (!rules) return false; // If no rules found, return null

      return true;
    };

  });

  // This also escapes some xml sequences
  module.filter('tableHighlight', function() {
    return function(text) {
      if (!_.isUndefined(text) && !_.isNull(text) && text.toString().length > 0) {
        return text.toString().
          replace(/&/g, '&amp;').
          replace(/</g, '&lt;').
          replace(/>/g, '&gt;').
          replace(/\r?\n/g, '<br/>').
          replace(/@start-highlight@/g, '<code class="highlight">').
          replace(/@end-highlight@/g, '</code>');
      }
      return '';
    };
  });

  module.filter('tableTruncate', function() {
    return function(text,length,factor) {
      if (!_.isUndefined(text) && !_.isNull(text) && text.toString().length > 0) {
        return text.length > length/factor ? text.substr(0,length/factor)+'...' : text;
      }
      return '';
    };
  });



  module.filter('tableJson', function() {
    var json;
    return function(text,prettyLevel) {
      if (!_.isUndefined(text) && !_.isNull(text) && text.toString().length > 0) {
        json = angular.toJson(text,prettyLevel > 0 ? true : false);
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if(prettyLevel > 1) {
          /* jshint maxlen: false */
          json = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
              if (/:$/.test(match)) {
                cls = 'key strong';
              } else {
                cls = '';
              }
            } else if (/true|false/.test(match)) {
              cls = 'boolean';
            } else if (/null/.test(match)) {
              cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
          });
        }
        return json;
      }
      return '';
    };
  });

  // WIP
  module.filter('tableLocalTime', function(){
    return function(text,event) {
      return moment(event.sort[1]).format("YYYY-MM-DDTHH:mm:ss.SSSZ");
    };
  });

});
