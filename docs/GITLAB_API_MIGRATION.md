# GitLab API Migration Guide

This document outlines the GitLab API endpoint updates implemented in this project to ensure compatibility with current and future GitLab versions.

## Updated Endpoints

### Merge Request Diffs (Recommended)

**New Endpoint (v15.7+):**

```
GET /projects/:id/merge_requests/:merge_request_iid/diffs
```

**Features:**

- Better performance and reliability
- Paginated results (`page`, `per_page` parameters)
- Unified diff format support (`unidiff` parameter)
- Subject to diff limits but handles large merge requests better

**Usage in Code:**

```javascript
// Get diffs with pagination
const diffs = await gitlabService.getMergeRequestDiffs(
  accessToken,
  projectPath,
  mrIid,
  { page: 1, per_page: 20, unidiff: true }
);
```

### Merge Request Changes (Deprecated)

**Deprecated Endpoint:**

```
GET /projects/:id/merge_requests/:merge_request_iid/changes
```

**Status:**

- Deprecated in GitLab 15.7
- Scheduled for removal in API v5
- Still supported for backward compatibility

**Migration Path:**
The application now uses `getMergeRequestDiffs()` as the primary method while keeping `getMergeRequestChanges()` for backward compatibility.

## Implementation Changes

### 1. GitLab Service Updates

**New Method Added:**

```javascript
async getMergeRequestDiffs(accessToken, projectPath, mrIid, options = {})
```

**Backward Compatibility:**

```javascript
async getMergeRequestChanges(accessToken, projectPath, mrIid) // Still available
```

### 2. Controller Updates

**Before:**

```javascript
const [changesData, commitsData] = await Promise.all([
  gitlabService.getMergeRequestChanges(accessToken, projectPath, mrIid),
  gitlabService.getMergeRequestCommits(accessToken, projectPath, mrIid),
]);

const reviewResult = await openaiService.generateCodeReview(
  mrData,
  changesData.changes || [],
  commitsData || []
);
```

**After:**

```javascript
const [diffsData, commitsData] = await Promise.all([
  gitlabService.getMergeRequestDiffs(accessToken, projectPath, mrIid),
  gitlabService.getMergeRequestCommits(accessToken, projectPath, mrIid),
]);

const reviewResult = await openaiService.generateCodeReview(
  mrData,
  diffsData || [],
  commitsData || []
);
```

## Additional Endpoints Added

### Merge Request Participants

```javascript
async getMergeRequestParticipants(accessToken, projectPath, mrIid)
```

### Merge Request Reviewers

```javascript
async getMergeRequestReviewers(accessToken, projectPath, mrIid)
```

## API v5 Compatibility

The implementation avoids deprecated fields and prepares for GitLab API v5:

### Avoided Deprecated Fields

- `merged_by` (use `merge_user` instead)
- `approvals_before_merge` (use Merge Request Approvals API)

### Future-Proof Implementation

- Error handling for new status codes
- Flexible response parsing
- Backward-compatible field access

## Testing

All endpoints are tested with the existing test suite:

```bash
npm test
```

The tests mock both old and new endpoints to ensure compatibility.

## Migration Checklist

- [x] Update GitLab service to use `/diffs` endpoint
- [x] Maintain backward compatibility with `/changes` endpoint
- [x] Update controller to use new diff data structure
- [x] Add new participant and reviewer endpoints
- [x] Update documentation
- [x] Ensure all tests pass
- [x] Add deprecation warnings in comments

## Rollback Plan

If issues arise, the application can easily rollback to the deprecated endpoint by:

1. Updating the controller to use `getMergeRequestChanges()`
2. Reverting the data structure handling
3. No database or configuration changes required

## Monitoring

Monitor the following for potential issues:

- GitLab API response times
- Error rates for new endpoints
- Diff size limitations
- Rate limiting behavior

## Resources

- [GitLab Merge Requests API Documentation](https://docs.gitlab.com/api/merge_requests.html)
- [GitLab API Deprecations](https://docs.gitlab.com/api/rest/deprecations/)
- [GitLab Diff Limits](https://docs.gitlab.com/administration/instance_limits/#diff-limits)
