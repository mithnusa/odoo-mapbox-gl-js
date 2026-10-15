# SearchableJson Field Test Suite

Comprehensive test suite for the custom SearchableJson field implementation in the web_view_mapbox_gl_draw module.

## Test Coverage

### 1. JsonValue Wrapper Tests (`TestJsonValue`)
- ✅ Basic creation with dict and list values
- ✅ Hash consistency for identical structures
- ✅ Key order independence (same hash for different key orders)
- ✅ Equality comparison between JsonValue instances
- ✅ Set operations (uniqueness based on content)
- ✅ Complex nested structures
- ✅ Error handling for non-serializable values

### 2. Domain Optimization Tests (`TestDomainOptimization`)
- ✅ `json_eq` optimization to `in` operator
- ✅ `json_ne` optimization to `not in` operator
- ✅ `json_contains` optimization to PostgreSQL `@>` operator
- ✅ `json_not_contains` pass-through for SQL handler
- ✅ JsonValue wrapping in optimization functions

### 3. SQL Generation Tests (`TestSearchableJsonField`)
- ✅ SQL generation for `in` operator with wrapped values
- ✅ SQL generation for `not in` operator with NULL handling
- ✅ PostgreSQL `@>` containment operator
- ✅ Negated containment (`NOT @>`) for `json_not_contains`
- ✅ Empty value sets (FALSE for `in`, TRUE for `not in`)
- ✅ Multiple values with OR/AND logic
- ✅ Error handling for non-serializable values
- ✅ Regular values without JsonValue wrapper

### 4. Integration Tests (`TestSearchableJsonIntegration`)
- ✅ Complex GeoJSON feature queries
- ✅ Polygon geometry containment
- ✅ GeoJSON property searches
- ✅ Geometry type filtering
- ✅ Multiple geometry type queries

### 5. Edge Cases (`TestEdgeCases`)
- ✅ Null/None values
- ✅ Empty dictionaries and lists
- ✅ Deeply nested structures
- ✅ Special characters and Unicode
- ✅ Numeric values (integers, decimals, negatives)
- ✅ Boolean values

## Running the Tests

### Run all tests in the module
```bash
# From Odoo root directory
python3 odoo-bin -c odoo.conf -d test_database --test-enable --stop-after-init -i web_view_mapbox_gl_draw
```

### Run specific test class
```bash
# Run only JsonValue tests
python3 odoo-bin -c odoo.conf -d test_database --test-enable --stop-after-init -i web_view_mapbox_gl_draw --test-tags=TestJsonValue
```

### Run specific test method
```bash
# Run a specific test
python3 odoo-bin -c odoo.conf -d test_database --test-enable --stop-after-init -i web_view_mapbox_gl_draw --test-tags=/test_json_value_hash_consistency
```

### Run with verbose output
```bash
python3 odoo-bin -c odoo.conf -d test_database --test-enable --stop-after-init -i web_view_mapbox_gl_draw --log-level=test
```

## Test Database Setup

The tests use Odoo's `TransactionCase` which provides automatic transaction rollback after each test. This ensures tests are isolated and don't affect each other.

### Requirements
- PostgreSQL database with JSONB support (PostgreSQL 9.4+)
- Odoo test database
- Module `web_view_mapbox_gl_draw` installed

### Create Test Database
```bash
# Create test database
createdb test_mapbox_draw

# Initialize with Odoo
python3 odoo-bin -c odoo.conf -d test_mapbox_draw -i base --stop-after-init
```

## Test Structure

```
tests/
├── __init__.py                      # Test discovery
├── README.md                        # This file
└── test_field_json_searchable.py   # Main test suite
```

## Example Test Scenarios

### Testing JSON Equality
```python
# Domain: [('geojson', 'json_eq', {'type': 'Point'})]
# Optimized to: [('geojson', 'in', [JsonValue({'type': 'Point'})])]
# SQL: geojson = '{"type":"Point"}'
```

### Testing JSON Containment
```python
# Domain: [('geojson', 'json_contains', {'geometry': {'type': 'Polygon'}})]
# Optimized to: [('geojson', '@>', {'geometry': {'type': 'Polygon'}})]
# SQL: geojson @> '{"geometry":{"type":"Polygon"}}'::jsonb
```

### Testing JSON Non-Containment
```python
# Domain: [('geojson', 'json_not_contains', {'type': 'Point'})]
# SQL: NOT (geojson @> '{"type":"Point"}'::jsonb)
```

## Adding New Tests

To add new tests, extend the appropriate test class in `test_field_json_searchable.py`:

```python
class TestSearchableJsonField(TransactionCase):
    def test_my_new_feature(self):
        """Test description."""
        # Test implementation
        self.assertEqual(expected, actual)
```

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Odoo Tests
  run: |
    python3 odoo-bin -c odoo.conf -d test_db \
      --test-enable --stop-after-init \
      -i web_view_mapbox_gl_draw \
      --log-level=test
```

## Debugging Failed Tests

### Enable verbose logging
```bash
python3 odoo-bin -c odoo.conf -d test_database \
  --test-enable --stop-after-init \
  -i web_view_mapbox_gl_draw \
  --log-level=debug \
  --log-handler=odoo.tests:DEBUG
```

### Use Python debugger
Add `import pdb; pdb.set_trace()` in your test:

```python
def test_my_feature(self):
    import pdb; pdb.set_trace()  # Debugger will stop here
    result = my_function()
    self.assertEqual(expected, result)
```

## Coverage Report

To generate a coverage report:

```bash
# Install coverage tool
pip install coverage

# Run tests with coverage
coverage run --source=. odoo-bin -c odoo.conf -d test_database \
  --test-enable --stop-after-init -i web_view_mapbox_gl_draw

# Generate report
coverage report -m
coverage html  # Creates htmlcov/index.html
```

## Known Limitations

1. **PostgreSQL Required**: Tests require PostgreSQL with JSONB support
2. **Mock Dependencies**: Some tests use mocks instead of actual database queries
3. **Integration Tests**: Full integration tests require a complete Odoo environment

## Contributing

When adding new features to SearchableJson field:

1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Add documentation to test docstrings
4. Update this README if adding new test categories

## Support

For issues or questions about the tests:
- Check test output for detailed error messages
- Review the SearchableJson field documentation
- Refer to Odoo testing documentation: https://www.odoo.com/documentation/17.0/developer/reference/backend/testing.html
