# Specification: SurveyToolkit

Signatures, schemas and contracts, never function bodies.

## Baseline

Output of `flux repomap` for the modules this sprint touches, pasted at plan time. Close Gate 2 diffs the finished code against this and the Interfaces section below.

```
[paste flux repomap output here]
```

## Summary

[1-3 sentence overview: what interfaces and contracts this spec defines, not how they are implemented]

## Decisions

### Cited

- [accepted ADRs this spec relies on, e.g. `0003 Title`]

### Proposed

- [ADRs in this sprint's `decisions/` directory, `status: proposed`]

## Technical Specifications

### Interfaces

[Function signatures, class interfaces, method signatures]

```python
def process_data(input: dict) -> Result:
    """Process input data and return result."""
```

### Data Models

[Schema definitions, dataclass structures, validation rules]

```python
@dataclass
class User:
    id: int
    name: str
    email: str
```

### Examples

[Call sites showing how the interfaces are used, not how they are implemented]

```python
result = process_data({"key": "value"})
print(result.status)
```

## Validation Criteria

[How to verify the implementation is correct: test commands, assertions, expected behavior]

```bash
python -m pytest tests/test_feature.py
# Expected: all tests pass
```
