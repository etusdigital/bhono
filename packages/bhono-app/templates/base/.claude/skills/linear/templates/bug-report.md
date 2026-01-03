# Bug Report Template

## Template Configuration

| Property | Value |
|----------|-------|
| **Name** | Bug Report |
| **Labels** | `bug` |
| **Priority** | 2 (High) or use triage |
| **Default Status** | Triage |

## Description Template

```markdown
## Summary
<!-- Brief description of the bug -->

## Environment
- **Browser/App**:
- **OS**:
- **Device**:
- **User Account**:

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
<!-- What should have happened -->

## Actual Behavior
<!-- What actually happened -->

## Screenshots/Videos
<!-- Attach visual evidence if applicable -->

## Console Errors
<!-- Paste any relevant error messages -->

## Additional Context
<!-- Any other relevant information -->
```

## CLI Usage

```bash
# Create bug report
npx tsx scripts/issues/create.ts \
  --title "Bug: [Component] - Brief description" \
  --description "## Summary
Login button does not respond on mobile Safari.

## Environment
- **Browser/App**: Safari 17.2
- **OS**: iOS 17.1
- **Device**: iPhone 15 Pro

## Steps to Reproduce
1. Open app on mobile Safari
2. Navigate to login page
3. Tap login button

## Expected Behavior
Login form should submit and redirect to dashboard.

## Actual Behavior
Nothing happens when tapping the button.

## Console Errors
\`\`\`
TypeError: Cannot read property 'submit' of null
\`\`\`" \
  --priority 2 \
  --json
```

## Best Practices

1. **Title Format**: `Bug: [Component/Feature] - Brief description`
   - `Bug: Cart - Cannot add items on mobile`
   - `Bug: Auth - Session expires unexpectedly`

2. **Include Visual Evidence**: Screenshots or screen recordings significantly speed up debugging

3. **Capture Console Logs**: JavaScript errors help developers reproduce issues

4. **Specify Environment**: Bugs often only appear in specific browsers/devices

5. **Be Specific**: "Button doesn't work" → "Login button doesn't respond to tap events on iOS Safari"

## Severity Guidelines

| Severity | Description | Example |
|----------|-------------|---------|
| **Urgent (1)** | App unusable, data loss | Payment processing fails |
| **High (2)** | Major feature broken | Cannot login |
| **Medium (3)** | Feature degraded | Slow page load |
| **Low (4)** | Minor issue | Typo in UI |
