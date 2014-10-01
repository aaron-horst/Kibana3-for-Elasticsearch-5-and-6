package KbnAuth::Command::migratint;
use strict;
use warnings;
use Mojo::Base 'Mojolicious::Command';
use Mojo::UserAgent;

has usage       => "usage: $0 migratint [username] [dashboards...]\n";
has description => "kibana-int index migration for auth users\n";

sub run {
    my ( $self, $user, @dashboards ) = @_;
    my $eshost = $self->app->config('eshost');
    my $ua     = Mojo::UserAgent->new;
    my $ret = $ua->get("$eshost/kibana-auth/indices/$user/_source")->res->json;
    die "No $user in kibana-auth!" unless $ret;
    my $userhost = $ret->{'server'} || $eshost;
    for my $dashboard (@dashboards) {
        my $dash = $ua->get("$userhost/kibana-int/dashboard/$dashboard/_source")
          ->res->json;
        say "No $dashboard exists." and next unless $dash;
        my $tx = $ua->post(
            "$userhost/kibana-int-$user/dashboard/$dashboard" => json =>
              $dash );
        say "$dashboard migration " . $tx->res->message;
    }
}

1;
