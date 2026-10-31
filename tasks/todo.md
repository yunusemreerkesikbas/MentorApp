# Invited pilot task list

> Historical checklist. Current decisions and execution:
> [free-first launch preparation](../docs/plans/2026-10-28-free-first-launch.md).
> Public signup, at most eight expected initial users, Resend Free and no automatic paid upgrades.

The registration package is approved; see [plan.md](./plan.md) for acceptance criteria,
verification and the separate decisions required by later slices.

- [x] Confirm first release: invited pilot, 20-50 users.
- [x] Replace the fixed operating-budget target with free-first evaluation and bounded paid usage.
- [x] Verify production-preparation PR #156 passed CI and was integrated outside this task.
- [x] Inspect password/OAuth registration and notification polling constraints.
- [x] Confirm invitation method: invited email list.
- [x] Review admission behavior and agree the first implementation slice.
- [x] Slice 1: prepare an itemized account-aware cost and measured performance profile.
- [x] Confirm Postmark Free and in-app/push daily-reminder preference with the owner.
- [x] Implement/test reminder-email dispatch and queued-mail suppression without affecting auth mail.
- [ ] Finish notification PR #158 full CI and review-ready validation.
- [x] Slice 2a: implement/test the shared registration-stop admission policy.
- [x] Slice 2b: wire/test password and Google creation in small increments.
- [x] Slice 3a: implement/test the agreed pilot admission policy.
- [x] Slice 3b: complete browser feedback verification/full CI and review the documented PR.
- [ ] Slice 4: agree journey/AI scope and verify usage bounds and the pilot journey.
- [ ] Checkpoint: approve hosting/provider allocations, scope and admin Access approach.
- [ ] Slice 5: prepare production provider acceptance under separately authorized operations.
- [ ] Slice 6: full CI, review, separately authorized publication and pilot observation.

Pilot [PR #157](https://github.com/yunusemreerkesikbas/MentorApp/pull/157) targets `master` at
`970ee732`. Both full CI runs passed on that commit: 1,015 browser passes (123 existing skips),
all 16 new pilot cases passed, and 90 separate CAPTCHA/account-security cases passed in each run.
The package is ready for review; pilot admission has not been activated.
No provisioning, DNS change, billing acceptance, merge or deployment is authorized by this package.
