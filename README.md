# woia-re-transactions

Thin Real Estate shared provider v0.5.8 for human-attributed negotiation/offer records, versioned reservations and independent sale milestones.

Read [the skill](skills/woia-re-transactions/SKILL.md) and [the execution contract](skills/woia-re-transactions/references/CONTRACT.md). The portable helper uses JavaScript ES modules and Node built-ins. It records facts; it never negotiates, dispatches contact, posts money or infers closing from a won pipeline stage.

The host must authenticate and resolve scoped policy/source inputs, validate [command envelopes](skills/woia-re-transactions/assets/request.schema.json), and atomically persist the reducer's returned state using organization+revision CAS. No live adapter or DBMS is selected. Source inspections/local regression are not Operator E2E or Production Ready.

## Maintenance

Pinned Node 24.21.0 / pnpm 11.19.0 are authoring requirements, independent from business permissions.

```text
mise trust
mise install
mise run bootstrap
mise run doctor
mise run test
mise run ci:fast
# commit the exact candidate; from the canonical WOIA Ecosystem repository:
mise run plugin:certify-thin --repo <absolute-provider-path>
```

Centralized thin certification is the authoritative clean-candidate/package/skills/payload/archive/domain gate. Retained scaffold full-profile extended/container/jobs/release scripts are dormant authoring options, not thin release gates and not claimed as executed. See the [maintenance instructions](https://github.com/Turpial-AI-Academy/woia-re-transactions-agent-plugin/blob/main/docs/MAINTENANCE.md) for the authoring workflow and [execution contract](skills/woia-re-transactions/references/CONTRACT.md) for qualification limits. No tag, release or registry admission is implied by an implementation candidate.
