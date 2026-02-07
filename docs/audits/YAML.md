# js-yaml Vulnerability Audit

**Date:** 2026-02-07
**Severity:** Moderate
**Status:** Unresolved (awaiting upstream fix)

## Summary

The project has 5 moderate severity vulnerabilities all stemming from a single root cause: `js-yaml < 3.14.2` has a prototype pollution vulnerability in its merge (`<<`) feature.

**Advisory:** [GHSA-mh29-5h37-fv8m](https://github.com/advisories/GHSA-mh29-5h37-fv8m)

## Vulnerability Details

**Prototype Pollution in js-yaml merge feature**

Prototype pollution allows an attacker to inject properties into JavaScript object prototypes, potentially leading to:
- Denial of service
- Property injection
- In some cases, remote code execution

**Affected versions:** js-yaml < 3.14.2
**Fixed in:** js-yaml >= 3.14.2

## Dependency Chain

```
@cornerstonejs/tools@4.15.30
  └── @cornerstonejs/core@4.15.30
        └── @kitware/vtk.js@34.15.1
              └── xmlbuilder2@3.0.2
                    └── js-yaml@3.14.0  ← VULNERABLE
```

All 5 reported vulnerabilities are the same issue counted at each level of this dependency chain.

## Current Package Versions

| Package | Installed | Latest | Uses |
|---------|-----------|--------|------|
| @cornerstonejs/core | ^4.15.30 | 4.15.31 | @kitware/vtk.js@34.15.1 |
| @cornerstonejs/tools | ^4.15.30 | 4.15.31 | @cornerstonejs/core |
| @kitware/vtk.js | 34.15.1 (transitive) | 34.16.3 | xmlbuilder2@3.0.2 |
| xmlbuilder2 | 3.0.2 (transitive) | 4.0.3 | js-yaml@3.14.0 |
| js-yaml | 3.14.0 (transitive) | 4.1.0+ | - |

## Why Updates Don't Fix This Yet

- `xmlbuilder2@4.0.3` uses `js-yaml@4.1.1` (FIXED)
- `xmlbuilder2@3.0.2` uses `js-yaml@3.14.0` (VULNERABLE)
- `@kitware/vtk.js` (even latest 34.16.3) still depends on `xmlbuilder2@3.0.2`

The fix requires `@kitware/vtk.js` to update their `xmlbuilder2` dependency to version 4.x.

## Risk Assessment

**Practical risk for this project: LOW**

Reasons:
1. The vulnerability requires parsing malicious YAML with the merge (`<<`) feature
2. `xmlbuilder2` is used for XML building, not YAML parsing from user input
3. It's part of VTK.js (3D visualization) used by Cornerstone (medical imaging)
4. We are not parsing untrusted YAML files through these libraries

## Mitigation Options

### Option 1: npm Overrides (Recommended)

Add to `package.json`:

```json
"overrides": {
  "js-yaml": "^3.14.2"
}
```

Then run:
```bash
rm -rf node_modules package-lock.json
npm install
npm audit
```

**Pros:** Immediate fix
**Cons:** May cause issues if packages rely on specific js-yaml 3.14.0 behavior

### Option 2: Wait for Upstream Fix

Monitor these repositories for updates:
- [@kitware/vtk.js](https://github.com/Kitware/vtk-js) - needs to update xmlbuilder2 to 4.x
- [@cornerstonejs/core](https://github.com/cornerstonejs/cornerstone3D) - will inherit fix from vtk.js

### Option 3: Accept the Risk

Given the low practical risk, this vulnerability can be documented and accepted until upstream packages are updated.

## Packages to Monitor for Updates

Check these periodically for versions that resolve the vulnerability:

| Package | Check Command | Fix Indicator |
|---------|---------------|---------------|
| @kitware/vtk.js | `npm view @kitware/vtk.js dependencies` | xmlbuilder2 >= 4.0.0 |
| @cornerstonejs/core | `npm view @cornerstonejs/core dependencies` | Updated vtk.js version |
| xmlbuilder2 | `npm view xmlbuilder2@<version> dependencies` | js-yaml >= 3.14.2 |

## Verification Commands

Check if vulnerability is resolved:
```bash
npm audit
```

Check current transitive dependency versions:
```bash
npm ls js-yaml
npm ls xmlbuilder2
npm ls @kitware/vtk.js
```

## Action Items

- [ ] Monitor @kitware/vtk.js releases for xmlbuilder2 update
- [ ] Consider applying npm override if vulnerability becomes a compliance concern
- [ ] Re-audit after any Cornerstone package updates

## References

- [GitHub Advisory GHSA-mh29-5h37-fv8m](https://github.com/advisories/GHSA-mh29-5h37-fv8m)
- [VTK.js GitHub Repository](https://github.com/Kitware/vtk-js)
- [Cornerstone3D GitHub Repository](https://github.com/cornerstonejs/cornerstone3D)
- [xmlbuilder2 npm](https://www.npmjs.com/package/xmlbuilder2)
