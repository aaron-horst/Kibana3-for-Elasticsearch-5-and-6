package KbnAuth::Inspector;
use strict;
use warnings;
use Mojo::Base -base;

has from     => 'now-1d';
has prefix   => 'logstash-';
has interval => 300;
has content  => '';

sub determine {
    my ( $self, $data ) = @_;
    return "Warning", $data;
}

sub begin {
    my ($self) = @_;
    if ( $self->from =~ m/-(\d+)(\w)$/ ) {
        if ( $2 eq 'h' ) {
            return ('minus_hours', $1);
        }
        elsif ( $2 eq 'd' ) {
            return ('minus_days', $1);
        }
        elsif ( $2 eq 'w' ) {
            return ('minus_weeks', $1);
        }
        else {
            warn "You really need so large time range?!";
        }
    }
}

sub jsoncontent {
    my ($self) = @_;
    my $from = $self->from;
    ( my $content = $self->content ) =~ s/\"from\": \d{13}/\"from\": \"$from\"/;
    $content =~ s/\"to\": \d{13}/\"to\": \"now\"/;
    return $content;
}

1;
