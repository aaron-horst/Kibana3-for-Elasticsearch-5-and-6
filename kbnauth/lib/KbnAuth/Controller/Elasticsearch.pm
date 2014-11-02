package KbnAuth::Controller::Elasticsearch;
use Mojo::Base 'Mojolicious::Controller';

sub proxy {
    my $self  = shift;
    my $preq  = $self->req->clone;
    my $esurl = $self->user('server') // $self->config('eshost');
    my ( $eshost, $esport ) = $esurl =~ m!^(?:https?://)?([^:]+)(?::(\d+))?!o;
    $eshost ||= 'localhost';
    $esport ||= 9200;
    $preq->url->scheme('http')->host($eshost)->port($esport);
    my $tx = Mojo::Transaction::HTTP->new( req => $preq );
    $self->render_later;
    $self->ua->start($tx => sub {
        my ($ua, $tx) = @_;
        $self->res->headers->access_control_allow_origin('*');
        $self->render( json => $tx->res->json );
    });
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
    my %seen = ();
    my @indices =
      grep { not $seen{$_}++ }
      grep { s/-\d{4}(?:\.\d{2}\.(?:\d{2})?)?$// || $_ }
      split( /,|\%2C/, $self->param('index') );
    return $self->render(
        json => { status => 403, error => 'IndexNoPermissionException' } )
      unless $self->permiss( \@indices );
    $self->proxy;
}

sub permiss {
    my ( $self, $indices ) = @_;
    my $prefix = $self->user('prefix') // [];
    my %e = map { $_ => undef } @{$prefix};
    return 1 if !grep( !exists( $e{$_} ), @{$indices} );
}

sub hidden_nodes {
    my $self       = shift;
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
