Publish a new release of this Stonetop FoundryVTT module to GitHub.

**Important prerequisite:** Foundry VTT must be closed before running this. The pack build and zip steps require the LevelDB files to be unlocked.

## Steps

1. Read the current `"version"` from `module.json`. Ask the user what the new version should be (suggest the next patch increment). Wait for their answer.

2. Run the release script via PowerShell, passing the chosen version:
   ```
   powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Version NEW_VERSION
   ```
   The script handles everything: rebuilding packs, updating module.json, committing, pushing, building the zip, creating the GitHub release, and uploading assets.

3. Report the results. Remind the user that the manifest URL users paste into Foundry never changes:
   `https://github.com/PrinceWitherdick/stonetop/releases/latest/download/module.json`
