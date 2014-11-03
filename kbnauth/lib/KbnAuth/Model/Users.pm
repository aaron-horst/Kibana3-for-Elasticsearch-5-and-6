package KbnAuth::Model::Users;
use Mojo::Base -base;
use Mojo::Cache;
use Mojo::UserAgent;
use Authen::Simple;

has ua     => sub { Mojo::UserAgent->new };
has cache  => sub { Mojo::Cache->new };
has config => sub { {} };
has host   => sub { shift->config->{'eshost'} // 'http://127.0.0.1:9200' };
has authen => sub {
    my $config = shift->config;
    my @adapters;
    for my $adapter ( keys %{ $config->{'authen'} } ) {
        my $sub_pm = "Authen::Simple::$adapter";
        eval "use $sub_pm";
        push @adapters, $sub_pm->new( %{ $config->{'authen'}->{$adapter} } );
    }
    Authen::Simple->new(@adapters);
};

sub check {
    my ( $self, $user, $pass ) = @_;
    if ( $self->authen->authenticate( $user, $pass ) ) {
        $self->rset($user);
        return 1;
    }
}

sub rset {
    my ( $self, $user ) = @_;
    my $host = $self->host;
    my $ret =
      $self->ua->new->get("$host/kibana-auth/indices/$user/_source")
      ->res->json;
    $self->cache->set( $user, $ret );
}

1;
