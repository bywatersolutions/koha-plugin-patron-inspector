#!/usr/bin/perl

use Modern::Perl;

BEGIN {
    unshift( @INC, '/var/lib/koha/kohadev/plugins' );
    unshift( @INC, '/kohadevbox/koha' );
    unshift( @INC, '/kohadevbox/koha/t/lib' );
}

use Test::NoWarnings;
use Test::More tests => 2;

# A dev install has the literal placeholder "{VERSION}" as its version, which
# makes every version compare in Koha::Plugins::Base warn. Koha::Plugins loads
# enabled plugins at compile time, so filter that noise before the Koha
# modules load or Test::NoWarnings fails on it.
BEGIN {
    my $previous_warn = $SIG{__WARN__};
    $SIG{__WARN__} = sub {
        return if $_[0] =~ m/Argument "\{VERSION\}" isn't numeric/;
        $previous_warn ? $previous_warn->(@_) : warn @_;
    };
}

use CGI;
use Test::MockModule;

use Koha::Database;

use t::lib::Mocks;
use t::lib::TestBuilder;

use Koha::Plugin::Com::LibraryPlugins::PatronInspector;

my $schema  = Koha::Database->new->schema;
my $builder = t::lib::TestBuilder->new;

subtest 'tool() tests' => sub {
    plan tests => 5;

    $schema->storage->txn_begin;

    my $attribute_type = $builder->build_object( { class => 'Koha::Patron::Attribute::Types' } );
    my $attribute_code = $attribute_type->code;

    t::lib::Mocks::mock_preference( 'borrowerRelationship', 'father|Mother|aunt' );
    t::lib::Mocks::mock_preference( 'dateformat',           'metric' );

    # Database sessions commit when they are destroyed, which would end this transaction
    t::lib::Mocks::mock_preference( 'SessionStorage', 'tmp' );

    # Keep the page out of the TAP stream
    my $html;
    my $plugin_module = Test::MockModule->new('Koha::Plugin::Com::LibraryPlugins::PatronInspector');
    $plugin_module->mock( output_html => sub { $html = $_[1] } );

    my $plugin = Koha::Plugin::Com::LibraryPlugins::PatronInspector->new( { cgi => CGI->new('method=tool') } );
    $plugin->tool();

    like(
        $html, qr/<title>Patron Import Pre-flight Inspector/,
        'the page is rendered with the staff interface templates'
    );
    like(
        $html, qr/var attributeTypeCodes = \[[^\]]*"\Q$attribute_code\E"/,
        'the patron attribute type codes are passed to the page'
    );
    like(
        $html, qr/var borrowerRelationships = \["father","Mother","aunt"\];/,
        'borrowerRelationship is split the same way Koha splits it'
    );
    like( $html, qr/var dateFormat = "metric";/, 'dateformat is passed to the page' );
    like( $html, qr/function sanitizeKohaDate/,  'inspector.js is included in the page' );

    $schema->storage->txn_rollback;
};
