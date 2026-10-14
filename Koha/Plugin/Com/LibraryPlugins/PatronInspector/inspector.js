// Included by inspector.tt, which sets attributeTypeCodes, borrowerRelationships and dateFormat first
var authData = { branches: new Set(), categories: new Set(), attributes: new Set(), relationships: new Set() };
var cleanedRows = [];
var changeLogs = [];
var currentFilter = 'all';

var APPROVED_HEADERS = new Set([
    'address', 'address2', 'altcontactaddress1', 'altcontactaddress2', 'altcontactaddress3', 
    'altcontactcountry', 'altcontactfirstname', 'altcontactphone', 'altcontactstate', 
    'altcontactsurname', 'altcontactzipcode', 'anonymized', 'auth_method', 'autorenew_checkouts', 
    'b_address', 'b_address2', 'b_city', 'b_country', 'b_email', 'b_phone', 'b_state', 
    'b_streetnumber', 'b_streettype', 'b_zipcode', 'borrowernotes', 'branchcode', 
    'cardnumber', 'categorycode', 'checkprevcheckout', 'city', 'contactfirstname', 
    'contactname', 'contactnote', 'contacttitle', 'country', 'date_renewed', 'dateenrolled', 
    'dateexpiry', 'dateofbirth', 'debarred', 'debarredcomment', 'email', 'emailpro', 'fax', 
    'firstname', 'flags', 'gonenoaddress', 'guarantor_id', 'guarantor_relationship', 'initials', 
    'lang', 'lastseen', 'login_attempts', 'lost', 'middle_name', 'mobile', 'opacnote', 
    'othernames', 'overdrive_auth_token', 'password', 'password_expiration_date', 
    'patron_attributes', 'phone', 'phonepro', 'preferred_name', 'primary_contact_method', 
    'privacy', 'privacy_guarantor_checkouts', 'privacy_guarantor_fines', 'pronouns', 
    'protected', 'relationship', 'secret', 'sex', 'sms_provider_id', 'smsalertnumber', 
    'sort1', 'sort2', 'state', 'streetnumber', 'streettype', 'surname', 'title', 
    'updated_on', 'userid', 'zipcode'
]);

function applyFilter(filterType) {
    currentFilter = filterType;
    document.getElementById('btnFilterAll').classList.toggle('active', filterType === 'all');
    document.getElementById('btnFilterFix').classList.toggle('active', filterType === 'fix');
    document.getElementById('btnFilterErr').classList.toggle('active', filterType === 'err');
    renderLogTable();
}

function cleanCell(str) {
    if (!str) return '';
    var s = str.trim();
    while ((s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
           (s.length >= 2 && s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
        s = s.substring(1, s.length - 1).trim();
    }
    return s;
}

function parseCSVText(text) {
    var lines = text.split(/\r\n|\n/);
    var result = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var row = [], inQuotes = false, current = '';
        for (var c = 0; c < line.length; c++) {
            var char = line[c];
            if (char === '"') { inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { row.push(current); current = ''; }
            else { current += char; }
        }
        row.push(current);
        result.push(row);
    }
    if (result.length === 0) return { headers: [], data: [] };
    var headers = result[0].map(function(h) { return cleanCell(h); });
    var data = [];
    for (var i = 1; i < result.length; i++) {
        var rowData = {};
        for (var j = 0; j < headers.length; j++) {
            rowData[headers[j]] = result[i][j] ? cleanCell(result[i][j]) : '';
        }
        data.push(rowData);
    }
    return { headers: headers, data: data };
}

function unparseCSV(data) {
    if (!data || !data.length) return '';
    var headers = Object.keys(data[0]);
    var csv = headers.join(',') + '\n';
    data.forEach(function(row) {
        var line = headers.map(function(h) {
            var val = row[h] || '';
            if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1) {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        }).join(',');
        csv += line + '\n';
    });
    return csv;
}

// Koha's patron import reads dates that aren't ISO in the order set by the dateformat system preference
var DATE_FORMATS = {
    us:     { order: ['month', 'day'], separator: '/', pattern: 'MM/DD/YYYY' },
    metric: { order: ['day', 'month'], separator: '/', pattern: 'DD/MM/YYYY' },
    dmydot: { order: ['day', 'month'], separator: '.', pattern: 'DD.MM.YYYY' }
};

function isCalendarDate(year, month, day) {
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function sanitizeKohaDate(val, rowNum, fieldName) {
    if (!val) return val;

    var format = DATE_FORMATS[dateFormat];
    var expected = format ? 'YYYY-MM-DD or ' + format.pattern : 'YYYY-MM-DD';

    // Koha accepts ISO dates whatever the dateformat system preference is
    var isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        if (!isCalendarDate(+isoMatch[1], +isoMatch[2], +isoMatch[3])) {
            changeLogs.push({ row: rowNum, field: fieldName, orig: val, clean: expected, msg: 'Invalid calendar date', type: 'err', category: 'Invalid Dates' });
        }
        return val;
    }

    var localMatch = format && val.match(/^(\d{1,2})([\/.\-])(\d{1,2})\2(\d{4})$/);
    if (localMatch) {
        var parts = { year: localMatch[4] };
        parts[format.order[0]] = localMatch[1].length === 1 ? '0' + localMatch[1] : localMatch[1];
        parts[format.order[1]] = localMatch[3].length === 1 ? '0' + localMatch[3] : localMatch[3];
        if (!isCalendarDate(+parts.year, +parts.month, +parts.day)) {
            changeLogs.push({ row: rowNum, field: fieldName, orig: val, clean: expected, msg: 'Invalid calendar date', type: 'err', category: 'Invalid Dates' });
            return val;
        }

        var formattedDate = [parts[format.order[0]], parts[format.order[1]], parts.year].join(format.separator);
        if (formattedDate === val) return val;

        if (localMatch[2] === format.separator) {
            changeLogs.push({ row: rowNum, field: fieldName, orig: val, clean: formattedDate, msg: 'Zero-padded date (' + val + ' -> ' + formattedDate + ')', type: 'fix', category: 'Dates Zero-Padded' });
        } else {
            changeLogs.push({ row: rowNum, field: fieldName, orig: val, clean: formattedDate, msg: 'Converted date separators (' + val + ' -> ' + formattedDate + ')', type: 'fix', category: 'Date Separators Converted' });
        }
        return formattedDate;
    }

    changeLogs.push({ row: rowNum, field: fieldName, orig: val, clean: expected, msg: 'Invalid date format (requires ' + expected + ')', type: 'err', category: 'Invalid Dates' });
    return val;
}

async function fetchKohaAuthorizedValues() {
    var statusEl = document.getElementById('authStatus');
    if (statusEl) statusEl.innerText = "Querying Koha for branches, categories, attributes, and relationships...";

    authData = { branches: new Set(), categories: new Set(), attributes: new Set(), relationships: new Set() };

    // 1. Fetch Branches
    try {
        var bRes = await fetch('/api/v1/libraries?_per_page=500');
        if (bRes.ok) {
            var branches = await bRes.json();
            if (Array.isArray(branches)) {
                branches.forEach(function(b) {
                    var code = b.library_id || b.branchcode || b.code;
                    if (code) authData.branches.add(String(code).trim().toUpperCase());
                });
            }
        }
    } catch (e) { console.warn("Libraries fetch skipped/failed:", e); }

    // 2. Fetch Categories
    try {
        var cRes = await fetch('/api/v1/patron_categories?_per_page=500');
        if (cRes.ok) {
            var categories = await cRes.json();
            if (Array.isArray(categories)) {
                categories.forEach(function(c) {
                    var code = c.patron_category_id || c.categorycode || c.code;
                    if (code) authData.categories.add(String(code).trim().toUpperCase());
                });
            }
        }
    } catch (e) { console.warn("Categories fetch skipped/failed:", e); }

    // 3. Patron Attribute Types come with the page, Koha has no REST endpoint that lists them
    attributeTypeCodes.forEach(function(code) {
        authData.attributes.add(code);
    });

    // 4. Guarantor Relationships come with the page from the borrowerRelationship system preference
    borrowerRelationships.forEach(function(rel) {
        if (rel) authData.relationships.add(rel);
    });

    if (statusEl) {
        statusEl.style.color = '#28a745';
        statusEl.innerText = '✓ Connected to Koha! Loaded ' + authData.branches.size + ' branches, ' + 
                           authData.categories.size + ' categories, ' + 
                           authData.attributes.size + ' attribute types, and ' + 
                           authData.relationships.size + ' relationships from system preferences.';
    }
}








function executeInspection() {
    var patronFileInput = document.getElementById('patronFile');

    if (!patronFileInput || !patronFileInput.files[0]) {
        alert('Please select a patron CSV file first.');
        return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
        var parsed = parseCSVText(e.target.result);
        cleanedRows = [];
        changeLogs = [];
        var rowsWithIssues = new Set();

        // Check the headers once, on the header row, so each problem is only logged once
        var cleanKeys = {};
        parsed.headers.forEach(function(rawKey) {
            var cleanKey = rawKey.trim().toLowerCase();

            if (cleanKey === 'patron_attribute') {
                changeLogs.push({ row: 1, field: 'Header', orig: rawKey, clean: 'patron_attributes', msg: "Corrected singular header 'patron_attribute' to 'patron_attributes'", type: 'fix', category: 'Headers Normalized' });
                cleanKey = 'patron_attributes';
            } else if (rawKey !== cleanKey) {
                changeLogs.push({ row: 1, field: 'Header', orig: rawKey, clean: cleanKey, msg: 'Header lowercased', type: 'fix', category: 'Headers Normalized' });
            }

            if (!APPROVED_HEADERS.has(cleanKey)) {
                changeLogs.push({ row: 1, field: 'Header', orig: rawKey, clean: 'Approved Koha Header', msg: "Header '" + rawKey + "' is not a recognized Koha borrower column", type: 'err', category: 'Invalid Column Headers' });
            }

            cleanKeys[rawKey] = cleanKey;
        });

        parsed.data.forEach(function(row, idx) {
            var rowNum = idx + 2;
            var newRow = {};

            for (var rawKey in row) {
                var cleanKey = cleanKeys[rawKey];
                var val = cleanCell(row[rawKey] || '');

                if (['dateofbirth', 'dateenrolled', 'dateexpiry'].indexOf(cleanKey) !== -1 && val) {
                    var originalVal = val;
                    val = sanitizeKohaDate(val, rowNum, cleanKey);
                    if (val !== originalVal) rowsWithIssues.add(rowNum);
                }

                if (cleanKey === 'branchcode' && val) {
                    if (val !== val.toUpperCase()) {
                        changeLogs.push({ row: rowNum, field: cleanKey, orig: val, clean: val.toUpperCase(), msg: 'Converted to uppercase', type: 'fix', category: 'System Codes Uppercased' });
                        val = val.toUpperCase();
                        rowsWithIssues.add(rowNum);
                    }
                    if (authData.branches.size > 0 && !authData.branches.has(val)) {
                        changeLogs.push({ row: rowNum, field: cleanKey, orig: val, clean: 'Valid Branch Code', msg: "Branchcode '" + val + "' not found in Koha DB", type: 'err', category: 'Unrecognized Branch Codes' });
                        rowsWithIssues.add(rowNum);
                    }
                }

                if (cleanKey === 'categorycode' && val) {
                    if (val !== val.toUpperCase()) {
                        changeLogs.push({ row: rowNum, field: cleanKey, orig: val, clean: val.toUpperCase(), msg: 'Converted to uppercase', type: 'fix', category: 'System Codes Uppercased' });
                        val = val.toUpperCase();
                        rowsWithIssues.add(rowNum);
                    }
                    if (authData.categories.size > 0 && !authData.categories.has(val)) {
                        changeLogs.push({ row: rowNum, field: cleanKey, orig: val, clean: 'Valid Category Code', msg: "Categorycode '" + val + "' not found in Koha DB", type: 'err', category: 'Unrecognized Category Codes' });
                        rowsWithIssues.add(rowNum);
                    }
                }

                if (['guarantor_relationship', 'relationship'].indexOf(cleanKey) !== -1 && val) {
                    // Koha only accepts an exact match, so fix the case to match the system preference
                    var matchingRelationship = authData.relationships.has(val) ? val : Array.from(authData.relationships).find(function(rel) {
                        return rel.toLowerCase() === val.toLowerCase();
                    });
                    if (matchingRelationship && val !== matchingRelationship) {
                        changeLogs.push({
                            row: rowNum,
                            field: cleanKey,
                            orig: val,
                            clean: matchingRelationship,
                            msg: 'Changed relationship to match the borrowerRelationship system preference',
                            type: 'fix',
                            category: 'Guarantor Relationship Normalized'
                        });
                        val = matchingRelationship;
                        rowsWithIssues.add(rowNum);
                    }
                    if (!matchingRelationship) {
                        changeLogs.push({
                            row: rowNum,
                            field: cleanKey,
                            orig: val,
                            clean: 'Valid Relationship Code',
                            msg: "Relationship '" + val + "' not found in the borrowerRelationship system preference",
                            type: 'err', 
                            category: 'Unrecognized Relationship Codes' 
                        });
                        rowsWithIssues.add(rowNum);
                    }
                }

                if (cleanKey === 'patron_attributes' && val) {
                    var attrPairs = [];
                    if (val.indexOf('|') !== -1) {
                        attrPairs = val.split('|');
                    } else {
                        attrPairs = val.match(/(?:[^\",]+|\"[^\"]*\")+/g) || [val];
                    }

                    var cleanedPairs = [];
                    attrPairs.forEach(function(pair) {
                        var rawPair = pair.trim();
                        if (!rawPair) return;

                        var pairClean = cleanCell(rawPair);
                        var parts = pairClean.split(':');
                        if (parts.length < 2) {
                            changeLogs.push({ row: rowNum, field: 'patron_attributes', orig: rawPair, clean: 'CODE:VALUE', msg: 'Malformed attribute pair', type: 'err', category: 'Malformed Attributes' });
                            cleanedPairs.push(pairClean);
                            rowsWithIssues.add(rowNum);
                            return;
                        }
                        
                        var attrCode = cleanCell(parts[0]);
                        var rawAttrVal = parts.slice(1).join(':');
                        var attrVal = cleanCell(rawAttrVal);

                        var cleanFormattedPair = attrCode + ':' + attrVal;

                        if (rawPair !== cleanFormattedPair) {
                            changeLogs.push({ 
                                row: rowNum, 
                                field: 'patron_attributes [' + attrCode + ']', 
                                orig: rawPair, 
                                clean: cleanFormattedPair, 
                                msg: 'Trimmed whitespace/quotes from attribute pair', 
                                type: 'fix', 
                                category: 'Attribute Whitespace Trimmed' 
                            });
                            rowsWithIssues.add(rowNum);
                        }

                        var isDateAttr = /date|dob|expire|expiry/i.test(attrCode) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(attrVal);
                        if (isDateAttr && attrVal) {
                            var origAttrVal = attrVal;
                            attrVal = sanitizeKohaDate(attrVal, rowNum, 'patron_attribute [' + attrCode + ']');
                            if (attrVal !== origAttrVal) rowsWithIssues.add(rowNum);
                        }

                        if (authData.attributes.size > 0 && !authData.attributes.has(attrCode)) {
                            changeLogs.push({ 
                                row: rowNum, 
                                field: 'patron_attributes', 
                                orig: attrCode, 
                                clean: 'Valid Attribute Code', 
                                msg: "Attribute code '" + attrCode + "' not found in Koha DB", 
                                type: 'err', 
                                category: 'Unrecognized Attribute Codes' 
                            });
                            rowsWithIssues.add(rowNum);
                        }

                        cleanedPairs.push(attrCode + ':' + attrVal);
                    });
                    
                    // Koha's patron import reads this field as a line of CSV, so pairs are comma separated and quoted if needed
                    val = cleanedPairs.map(function(pair) {
                        return /[",]/.test(pair) ? '"' + pair.replace(/"/g, '""') + '"' : pair;
                    }).join(',');
                }

                newRow[cleanKey] = val;
            }
            cleanedRows.push(newRow);
        });

        renderDashboard(parsed.data.length, rowsWithIssues.size);
    };
    reader.readAsText(patronFileInput.files[0]);
}

function renderDashboard(totalRows, countWithIssues) {
    document.getElementById('resultsSection').style.display = 'block';

    var fixCount = changeLogs.filter(function(l) { return l.type === 'fix'; }).length;
    var errCount = changeLogs.filter(function(l) { return l.type === 'err'; }).length;
    var cleanCount = totalRows - countWithIssues;

    document.getElementById('statTotal').innerText = totalRows;
    document.getElementById('statClean').innerText = cleanCount;
    document.getElementById('statFixed').innerText = fixCount;
    document.getElementById('statErrors').innerText = errCount;

    var summaryList = document.getElementById('summaryList');
    summaryList.innerHTML = '';
    if (changeLogs.length === 0) {
        summaryList.innerHTML = '<li style="color:#28a745; font-weight:bold;">✓ Perfect file! 100% of rows are compliant with Koha standards.</li>';
    } else {
        var categoryCounts = {};
        changeLogs.forEach(function(log) {
            categoryCounts[log.category] = (categoryCounts[log.category] || 0) + 1;
        });

        for (var cat in categoryCounts) {
            var count = categoryCounts[cat];
            summaryList.innerHTML += '<li><strong>' + cat + ':</strong> ' + count + ' instance' + (count > 1 ? 's' : '') + ' found.</li>';
        }
    }

    renderLogTable();
}

function renderLogTable() {
    var tbody = document.getElementById('auditBody');
    if (!tbody) return;

    var filtered = changeLogs.filter(function(log) {
        if (currentFilter === 'fix') return log.type === 'fix';
        if (currentFilter === 'err') return log.type === 'err';
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#666; padding:20px;">No entries match the selected filter.</td></tr>';
        return;
    }

    var html = '';
    filtered.forEach(function(log) {
        var isFix = log.type === 'fix';
        var badge = isFix 
            ? '<span class="badge-ok">AUTO-FIXED</span>' 
            : '<span class="badge-err">ERROR</span>';

        html += '<tr>' +
            '<td>Row ' + log.row + '</td>' +
            '<td><strong>' + escape_str(log.field) + '</strong></td>' +
            '<td><code>' + escape_str(log.orig) + '</code></td>' +
            '<td><code>' + escape_str(log.clean) + '</code></td>' +
            '<td>' + badge + ' ' + escape_str(log.msg) + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
}

function downloadCleanedCSV() {
    var csv = unparseCSV(cleanedRows);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'koha_patrons_cleaned.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

(function() {
    function initInspector() {
        fetchKohaAuthorizedValues();

        var inspectBtn = document.getElementById('inspectBtn');
        var downloadBtn = document.getElementById('downloadBtn');

        if (inspectBtn) inspectBtn.addEventListener('click', executeInspection);
        if (downloadBtn) downloadBtn.addEventListener('click', downloadCleanedCSV);

        var btnFilterAll = document.getElementById('btnFilterAll');
        var btnFilterFix = document.getElementById('btnFilterFix');
        var btnFilterErr = document.getElementById('btnFilterErr');

        if (btnFilterAll) btnFilterAll.addEventListener('click', function() { applyFilter('all'); });
        if (btnFilterFix) btnFilterFix.addEventListener('click', function() { applyFilter('fix'); });
        if (btnFilterErr) btnFilterErr.addEventListener('click', function() { applyFilter('err'); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initInspector);
    } else {
        initInspector();
    }
})();
