// Unit tests for the inspector JavaScript, run with: node --test t/inspector.test.js

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(
    path.join(__dirname, '../Koha/Plugin/Com/LibraryPlugins/PatronInspector/inspector.js'),
    'utf8'
);

// Loads inspector.js with the values inspector.tt would set, and Koha's libraries and categories
async function loadInspector(settings = {}) {
    const elements = {};
    const context = vm.createContext({
        console,
        attributeTypeCodes: settings.attributeTypeCodes || ['GRADE', 'SCHOOLCODE', 'NOTE'],
        borrowerRelationships: settings.borrowerRelationships || ['father', 'Mother', 'aunt'],
        dateFormat: settings.dateFormat || 'us',
        document: {
            readyState: 'loading',
            addEventListener() {},
            getElementById(id) { return elements[id] || null; },
        },
        fetch: async (url) => ({
            ok: true,
            json: async () => url.includes('/libraries')
                ? [{ library_id: 'CPL' }, { library_id: 'FPL' }]
                : [{ patron_category_id: 'PT' }, { patron_category_id: 'J' }],
        }),
        // Koha's escape_str from staff-global.js
        escape_str: (s) => s != null ? String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) : '',
    });
    vm.runInContext(SOURCE, context);
    await context.fetchKohaAuthorizedValues();
    context.elements = elements;
    return context;
}

// Runs a CSV through the inspector the way the Inspect button does, values come back as plain JSON
function inspect(context, csv) {
    let dashboard;
    context.elements.patronFile = { files: [csv] };
    context.FileReader = class {
        readAsText(file) { this.onload({ target: { result: file } }); }
    };
    context.renderDashboard = (totalRows, countWithIssues) => {
        dashboard = { totalRows, cleanRows: totalRows - countWithIssues };
    };
    context.executeInspection();
    return JSON.parse(JSON.stringify({ ...dashboard, logs: context.changeLogs, rows: context.cleanedRows }));
}

function checkDate(context, value) {
    context.changeLogs = [];
    const result = context.sanitizeKohaDate(value, 2, 'dateofbirth');
    return { value: result, logs: JSON.parse(JSON.stringify(context.changeLogs)) };
}

test('sanitizeKohaDate() with the us dateformat', async () => {
    const context = await loadInspector({ dateFormat: 'us' });

    assert.deepStrictEqual(checkDate(context, '1990-01-15'), { value: '1990-01-15', logs: [] }, 'ISO dates are accepted');
    assert.deepStrictEqual(checkDate(context, '02/29/2024'), { value: '02/29/2024', logs: [] }, 'leap day is accepted');

    let result = checkDate(context, '1/5/1985');
    assert.strictEqual(result.value, '01/05/1985', 'unpadded date is zero-padded');
    assert.strictEqual(result.logs[0].type, 'fix');

    result = checkDate(context, '5-3-2030');
    assert.strictEqual(result.value, '05/03/2030', 'hyphenated date is converted');
    assert.strictEqual(result.logs[0].category, 'Date Separators Converted');

    for (const value of ['2024-02-30', '13/45/2024', '13/5/2024', 'Jan 5 1990']) {
        result = checkDate(context, value);
        assert.strictEqual(result.value, value, value + ' is left unchanged');
        assert.strictEqual(result.logs[0].type, 'err', value + ' is an error');
    }
});

test('sanitizeKohaDate() with the metric, dmydot and iso dateformats', async () => {
    let context = await loadInspector({ dateFormat: 'metric' });
    assert.strictEqual(checkDate(context, '13/5/2024').value, '13/05/2024', 'metric reads day first');
    assert.strictEqual(checkDate(context, '02/29/2024').logs[0].type, 'err', 'metric has no month 29');

    context = await loadInspector({ dateFormat: 'dmydot' });
    assert.strictEqual(checkDate(context, '1/5/1985').value, '01.05.1985', 'dmydot uses dots');

    context = await loadInspector({ dateFormat: 'iso' });
    assert.deepStrictEqual(checkDate(context, '1985-01-05'), { value: '1985-01-05', logs: [] }, 'iso accepts ISO dates');
    assert.strictEqual(checkDate(context, '1/5/1985').logs[0].type, 'err', 'iso accepts nothing else');
});

test('a row with only a date problem is not counted as clean', async () => {
    const context = await loadInspector();
    const result = inspect(context, [
        'surname,cardnumber,branchcode,categorycode,dateofbirth',
        'Clean,PI01,CPL,PT,1990-01-15',
        'Invalid,PI02,CPL,PT,2024-02-30',
        'Padded,PI03,CPL,PT,1/5/1985',
    ].join('\n'));

    assert.strictEqual(result.totalRows, 3);
    assert.strictEqual(result.cleanRows, 1, 'only the first row is clean');
});

test('patron attributes', async () => {
    const context = await loadInspector();
    const result = inspect(context, [
        'surname,cardnumber,patron_attributes',
        'Comma,PI01,"GRADE:5,SCHOOLCODE:EHS"',
        'Pipe,PI02,"GRADE:5|NOTE:a, b"',
        'Unknown,PI03,FAVORITE:blue',
    ].join('\n'));

    assert.strictEqual(result.rows[0].patron_attributes, 'GRADE:5,SCHOOLCODE:EHS', 'pairs stay comma separated');
    assert.strictEqual(result.rows[1].patron_attributes, 'GRADE:5,"NOTE:a, b"', 'a pair containing a comma is quoted');

    const errors = result.logs.filter((log) => log.type === 'err');
    assert.deepStrictEqual(errors.map((log) => log.orig), ['FAVORITE'], 'only the unknown code is an error, SCHOOLCODE is known');
});

test('relationships are checked against the borrowerRelationship system preference', async () => {
    const context = await loadInspector({ borrowerRelationships: ['father', 'Mother', 'aunt'] });
    const result = inspect(context, [
        'surname,cardnumber,guarantor_relationship',
        'Case,PI01,mother',
        'Listed,PI02,aunt',
        'Unlisted,PI03,grandparent',
    ].join('\n'));

    assert.deepStrictEqual(result.rows.map((row) => row.guarantor_relationship), ['Mother', 'aunt', 'grandparent']);
    assert.deepStrictEqual(
        result.logs.map((log) => [log.row, log.type]),
        [[2, 'fix'], [4, 'err']],
        'case is fixed for row 2, row 4 is an error, row 3 is fine'
    );
});

test('header problems are logged once', async () => {
    const context = await loadInspector();
    const result = inspect(context, [
        'Surname,cardnumber,favorite_color',
        'One,PI01,blue',
        'Two,PI02,red',
        'Three,PI03,green',
    ].join('\n'));

    assert.deepStrictEqual(
        result.logs.map((log) => [log.row, log.orig, log.type]),
        [[1, 'Surname', 'fix'], [1, 'favorite_color', 'err']]
    );
    assert.deepStrictEqual(Object.keys(result.rows[0]), ['surname', 'cardnumber', 'favorite_color'], 'the cleaned file has the fixed header');
    assert.strictEqual(result.cleanRows, 3, 'header problems do not count against the rows');
});

test('the issue log escapes values from the file', async () => {
    const context = await loadInspector();
    context.elements.auditBody = { innerHTML: '' };
    context.changeLogs = [
        { row: 1, field: 'Header', orig: '<img src=x onerror=alert(1)>', clean: 'Approved Koha Header', msg: "Header '<img>' is not recognized", type: 'err' },
    ];
    context.renderLogTable();

    const html = context.elements.auditBody.innerHTML;
    assert.ok(!html.includes('<img'), 'no markup from the file is in the table');
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'it is shown as text');
});
