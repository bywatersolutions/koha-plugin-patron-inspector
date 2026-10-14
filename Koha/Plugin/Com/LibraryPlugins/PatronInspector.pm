package Koha::Plugin::Com::LibraryPlugins::PatronInspector;

use strict;
use warnings;
use base qw(Koha::Plugins::Base);
use C4::Context;

our $VERSION = "{VERSION}";

our $metadata = {
    name            => 'Patron Import Pre-flight Inspector',
    author          => 'ByWater Solutions Data Team',
    description     => 'Pre-flight CSV inspection and auto-sanitization tool for Koha patron imports.',
    date_authored   => '2026-10-07',
    date_updated    => "1900-01-01",
    minimum_version => '20.05.00.000',
    maximum_version => undef,
    version         => $VERSION,
};

sub new {
    my ( $class, $args ) = @_;
    $args->{metadata} = $metadata;
    $args->{metadata}->{class} = $class;
    my $self = $class->SUPER::new($args);
    return $self;
}

sub tool {
    my ( $self, $args ) = @_;

    my $template = $self->get_template( { file => 'inspector.tt' } );
    $template->param( VERSION => $VERSION );

    $self->output_html( $template->output() );
}

sub install {
    my ( $self, $args ) = @_;
    return 1;
}

sub uninstall {
    my ( $self, $args ) = @_;
    return 1;
}

1;
