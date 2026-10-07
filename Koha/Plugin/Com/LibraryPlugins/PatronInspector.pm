package Koha::Plugin::Com::LibraryPlugins::PatronInspector;

use strict;
use warnings;
use base qw(Koha::Plugins::Base);
use C4::Context;
use C4::Auth qw( get_template_and_user );
use CGI;
use Template;

our $VERSION = '1.0.0';

our $metadata = {
    name            => 'Patron Import Pre-flight Inspector',
    author          => 'ByWater Solutions Data Team',
    description     => 'Pre-flight CSV inspection and auto-sanitization tool for Koha patron imports.',
    date_authored   => '2026-10-07',
    date_updated    => '2026-10-07',
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
    my $cgi = $self->{cgi};

    # 1. Read raw inspector.tt file from disk
    my $template_path = $self->mbf_path('inspector.tt');
    open( my $fh, '<:encoding(UTF-8)', $template_path ) 
        or die "Could not open template file $template_path: $!";
    my $raw_tt = do { local $/; <$fh> };
    close($fh);

    # 2. Configure Template Toolkit with Koha core include paths and plugin base
    my $intrahtdocs = C4::Context->config('intrahtdocs') || '/usr/share/koha/intranet/htdocs/intranet-tmpl';
    my @include_paths = (
        "$intrahtdocs/prog/en/includes",
        "$intrahtdocs/prog/en/modules",
        "$intrahtdocs/prog/en"
    );

    my $tt = Template->new(
        {
            ABSOLUTE     => 1,
            RELATIVE     => 1,
            INCLUDE_PATH => \@include_paths,
            PLUGIN_BASE  => 'Koha::Template::Plugin',
            ENCODING     => 'utf8',
        }
    );

    # 3. Pass variables into Template Toolkit
    my $vars = {
        CLASS   => $self->{class},
        METHOD  => 'tool',
        VERSION => $VERSION,
    };

    # 4. Render template string into parsed HTML
    my $parsed_html = '';
    $tt->process( \$raw_tt, $vars, \$parsed_html )
      or die "Template processing error: " . $tt->error();

    # 5. Output processed HTML via Koha's output_html pipeline
    $self->output_html( $parsed_html, undef, { query => $cgi } );
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
