# Stats Maker R21 Release Notes

## P1 Remix Lineage & Flow

### Remix context inside the editor
- Remixed sheets now show a dedicated Remix source panel above Community.
- The panel shows the source work title and explains the two distinct paths:
  - Join the source Community.
  - Publish as your own version.
- Added direct actions for “View source” and “Publish my version”.
- Creator scores are never copied into a Remix; only the structure is inherited.

### Publish lineage
- Publishing a remixed sheet now links the new public work to its source topic.
- Remix relation metadata is stored inside the publish snapshot.
- Updating an already-published work preserves its existing DB lineage.
- When Community submissions force a structural new version, that new work is marked as a version relation rather than a Remix relation.

### Public page
- Derived public works display their source relationship.
- Correctly distinguishes:
  - Remix source
  - Previous version
  - Generic source for legacy derived records
- Remix button shows the number of public/unlisted Remix children.
- Version children are not counted as Remixes.
- Public-page guidance now clearly explains Community participation vs publishing your own version.

### Migration
- No new Supabase migration required.
- R21 relationship type is stored in existing snapshot JSON.
- Active cache key: `r21p1`.
