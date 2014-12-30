package KbnAuth::Command::alertwork;
use strict;
use warnings;
use Mojo::Base 'Mojolicious::Command';
use Mojo::UserAgent;
use Mojo::IOLoop;
use Mojo::JSON qw/decode_json/;
use Mojo::Util qw/dumper/;
use File::Spec;
use Time::Moment;
use Data::Dumper;

has usage       => "usage: $0 alertwork\n";
has description => "fetch aggregations from elasticsearch like kibana,"
                 . " then determine whether alert or not.\n";

has ua          => sub { Mojo::UserAgent->new };
has inspector   => sub {
    my $pwd = +(File::Spec->splitpath(File::Spec->rel2abs(__FILE__)))[1];
    $pwd =~ s!Command/$!Inspector/*!;
    return [ glob($pwd) ];
};

sub run {
    my ( $self ) = @_;
    my $eshost = $self->app->config('eshost');
    for my $plug (@{$self->inspector}) {
        require "$plug";
        $plug =~ s!^.*/(\w+)\.pm$!KbnAuth::Inspector::$1!;
        my $pm = $plug->new;
        my $interval = $pm->interval;
        my $prefix = $pm->prefix;
        my $json = decode_json($pm->jsoncontent);
        my ($unit, $num) = $pm->begin;
        $self->app->log->debug("Beginning $plug every $interval using ".dumper($json));
        Mojo::IOLoop->recurring($interval => sub {
            my $t = Time::Moment->now_utc;
            my @indices;
            for my $ago (0 .. $num) {
                push @indices, $prefix . $t->$unit($ago)->strftime('%Y.%M.%d');
            };
            my $url = $eshost . '/' . join(',', @indices) . '/_search';
            $self->app->log->debug("Search $url");
            $self->ua->post($url => {Accept => '*/*'} => json => $json => sub {
                my ($ua, $tx) = @_;
                $self->app->log->debug("Got ".$tx->res->body);
                my ($ret, $msg) = $pm->determine( $tx->res->json );
                if ( $ret ) {
                    my $esurl = $eshost . '/logstash-alert-' . $t->strftime('%Y.%M.%d') . +(split('::', $plug))[-1];
                    $ua->post($esurl => {Accept => '*/*'} => json => $msg);
                };
            });
        });
    };
    Mojo::IOLoop->start unless Mojo::IOLoop->is_running;
}

1;
