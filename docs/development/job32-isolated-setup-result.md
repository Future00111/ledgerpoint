# Job32 isolated setup — 2026-11-10

Owner approved a separate full-app test setup and development test identities.
Application source: bfa37c454c99b3dcd9fe871139c9c4e025abb5a3.
Setup/evidence retained outside this checkout in ../launch.mjs and ../evidence.

Fresh database ledgerly_job32_auth_test, new private Unix socket, installer
identity checked before installation, restricted ledgerly_api runtime identity
checked before listening. Actual createApp and App used; no beforeClerkMiddleware,
fixture identity injection, scheduler entrypoint, demo launcher or ambient
database credentials. Only development Clerk keys were admitted, without values
printed or stored in launch files. Explicit single-origin CORS used for
http://127.0.0.1:58974. No original demo/database was accessed.

Verified: full application renders real Clerk sign-in; anonymous GET
/api/companies returns 401 Unauthorized. Automated tester confirmed both.

The supported programmatic login helper was invoked once for a synthetic test
identity. Its generated URL was not followed: the documented basePath controls
only a path on the Replit development domain, not loopback. That application
origin remains prohibited by earlier owner instructions. No authenticated
session or verified subject was obtained, and no company membership was seeded.
The helper may have created its requested development test identity; deletion
was not attempted without a verified subject. No existing accounts were changed.

All owned API/PostgreSQL processes stopped and the explicitly disposable cluster
was removed, with cleanup receipt. Launch files/builds and evidence are retained.
No product code, provider settings, demo workflows, shared data, frozen export,
original candidate branch, queue, integration branch or deployment changed.

Remaining approval: permit browser access only to a newly routed /job32-auth/
test path on the development domain plus its existing Clerk authentication
transport, not the existing demo routes. Then repeat isolated startup with a new
evidence directory and the helper's matching basePath. Do not overwrite this run.

Job32 remains incomplete: interactive sign-in, authenticated company switching,
role/inactive/revoked access, reload, sign-out/session expiry and protected
downloads are not accepted by the anonymous checks above.
