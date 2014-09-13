package KbnAuth::Model::Users;
use strict;
use warnings;
use Mojo::UserAgent;

sub new {
  my ($class, $config) = @_;
  my $self = {
    users => $config->{'users'},
    eshost => $config->{'eshost'},
  };
  return bless $self, $class;
}

sub check {
  my ($self, $user, $pass) = @_;
  return 1 if $self->{users}->{$user} && $self->{users}->{$user} eq $pass;
  return undef;
}

sub permiss {
  my ($self, $user, $indices) = @_;
  my $eshost = $self->{eshost};
  my $ret = Mojo::UserAgent->new->get("$eshost/kibana-auth/indices/$user/_source")->res->json;
  my %e = map{ $_ => undef } @{$indices};
  return 1 if $self->{users}->{$user} && !grep( !exists( $e{$_} ), @{$ret->{'prefix'}} );
  return undef;
}

1;
