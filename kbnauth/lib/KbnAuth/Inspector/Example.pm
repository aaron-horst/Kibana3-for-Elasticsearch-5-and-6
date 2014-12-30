package KbnAuth::Inspector::Example;
use strict;
use warnings;
use Mojo::Base 'KbnAuth::Inspector';

has prefix  => 'logstash-mweibo-';
has interval=> 5;
has content => <<'EOF';
{
  "facets": {
    "terms": {
      "terms": {
        "field": "jsoncontent.errmsg.raw",
        "size": 10,
        "order": "count",
        "exclude": []
      },
      "facet_filter": {
        "fquery": {
          "query": {
            "filtered": {
              "query": {
                "bool": {
                  "should": [
                    {
                      "query_string": {
                        "query": "*"
                      }
                    }
                  ]
                }
              },
              "filter": {
                "bool": {
                  "must": [
                    {
                      "range": {
                        "@timestamp": {
                          "from": 1419459071110,
                          "to": 1419502271111
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
  },
  "size": 0
}
EOF

sub determine {

}

1;
