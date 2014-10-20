package KbnAuth::Model::Users;
use strict;
use warnings;
use Authen::Simple;
use Mojo::UserAgent;

sub new {
  my ($class, $config) = @_;
  my @adapters;
  for my $adapter ( keys %{$config->{'authen'}} ) {
    my $sub_pm = "Authen::Simple::$adapter";
    eval "use $sub_pm";
    push @adapters, $sub_pm->new(%{$config->{'authen'}->{$adapter}});
  };
  my $self = {
    authen => Authen::Simple->new(@adapters),
    eshost => $config->{'eshost'},
  };
  return bless $self, $class;
}

sub check {
  my ($self, $user, $pass) = @_;
  return 1 if $self->{authen}->authenticate($user, $pass);
  return undef;
}

sub permiss {
  my ($self, $user, $indices) = @_;
  my $eshost = $self->{eshost};
  my $ret = Mojo::UserAgent->new->get("$eshost/kibana-auth/indices/$user/_source")->res->json;
  my %e = map{ $_ => undef } @{$ret->{'prefix'}};
  return 1 if !grep( !exists( $e{$_} ), @{$indices} );
  return undef;
}

sub server {
  my ($self, $user) = @_;
  my $eshost = $self->{eshost};
  my $ret = Mojo::UserAgent->new->get("$eshost/kibana-auth/indices/$user/_source")->res->json;
  return $ret->{'server'};
}

sub default_route {
  my ($self, $user) = @_;
  my $eshost = $self->{eshost};
  my $ret = Mojo::UserAgent->new->get("$eshost/kibana-auth/indices/$user/_source")->res->json;
  return $ret->{'route'} || '/dashboard/file/default.json';
}

1;
