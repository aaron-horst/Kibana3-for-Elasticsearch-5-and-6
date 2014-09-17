package KbnAuth::Controller::Elasticsearch;
use Mojo::Base 'Mojolicious::Controller';
use List::MoreUtils 'uniq';

sub proxy {
  my $self = shift;
  my $preq = $self->req->clone;
  my $esurl = $self->users->server($self->session('user')) // $self->config('eshost');
  my ( $eshost, $esport ) = $esurl =~ m!^http://(.+)(?::(\d+))!;
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
  my $local_addr = $self->tx->local_address;
  my $local_port = $self->tx->local_port;
  $self->render(
    json => {
      nodes => {
        "web" => {
          version      => '1.1.1',
          http_address => "inet[/$local_addr:$local_port]",
          ip           => "$local_addr",
        }
      }
    }
  );
}

1;
