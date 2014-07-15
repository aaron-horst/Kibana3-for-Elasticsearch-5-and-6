chenryn's changelog
================

## percentile panel

Percentile is a great data analysis method. Elasticsearch add percentile aggregation support after version 1.1.0. But Kibana v3 use an outdate elastic.js which don't support aggergation! So I write this panel using native angularjs `$.http` api.

Elasticsearch will add percentile rank in version 1.3.0, so exciting!

## china map

Use map.cn.js from <http://jvectormap.com/maps/countries/china/>, delete `CN-` because `filter/geoip` don't have such prefix.

Add Taiwan to this map.

Many thanks to this author(@loveshell)!

## statisticstrend panel

This panel is so useful if you want to check the trend of your statistic history.

Many thanks to this author(@opsSysDev)!
