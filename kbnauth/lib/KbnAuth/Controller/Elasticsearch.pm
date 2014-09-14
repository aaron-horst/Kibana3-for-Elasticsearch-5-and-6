package KbnAuth::Controller::Elasticsearch;
use Mojo::Base 'Mojolicious::Controller';
use List::MoreUtils 'uniq';

sub proxy {
  my $self = shift;
  my $preq = $self->req->clone;
  my ( $eshost, $esport ) = qw(127.0.0.1 9200);
  ( $eshost, $esport ) = $self->config('eshost') =~ m!^http://(.+):(\d+)!;
  $eshost = $self->users->server($self->session('user'))
    if $self->users->server($self->session('user'));
  $preq->url->scheme('http')->host($eshost)->port($esport);
  my $tx = Mojo::Transaction::HTTP->new( req => $preq );
  $self->ua->start($tx);
  $self->render( json => $tx->res->json );
}

sub auth_dashboards {
  my $self = shift;
  return $self->render(
    json => { status => 404, error => 'DashboardsNoPermissionException' } )
    unless $self->param('kbnidx') eq 'kibana-int-' . $self->session('user');
  $self->proxy;
}

sub auth_proxy {
  my $self = shift;
  my @indices = uniq grep { s/-\d{4}\.\d{2}\.\d{2}$// } split( /,/, $self->param('index') );
  return $self->render(
    json => { status => 404, error => 'IndexNoPermissionException' } )
    unless $self->users->permiss( $self->session('user'), \@indices );
  $self->proxy;
}

sub hidden_nodes {
  my $self = shift;
  $self->render(
    json => {
      nodes => {
        "web" => {
          version      => '1.1.1',
          http_address => "inet[/192.168.0.102:3000]",
          ip           => '192.168.0.102'
        }
      }
    }
  );
}

1;
