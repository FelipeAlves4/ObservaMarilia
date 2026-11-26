## Overview

This contract records the canonical authentication workflow for ObservaMarília. It applies to the public `#/acesso` route and is implemented by `src/pages/Access.tsx` and `src/components/AuthUi.tsx`.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | `auth-*` field family | This contract and `AuthUi.tsx` | Area choice, login, citizen registration, recovery, reset | Build and keyboard validation |
| Select/Listbox | Native select | This contract | Platform popup accepted | Browser selection and keyboard |
| Date | Native datetime-local | This contract | Platform picker accepted | Browser value entry |
| Toast | Inline `AuthFeedback` | This contract and `AuthUi.tsx` | Error, success, information | Live region and visual state |
| CRUD | Supabase Auth methods | `Access.tsx` and Supabase Auth | Sign-in, sign-up, recovery, reset | Build and configured Auth environment |
| Administrative CRUD | `manage-admin` Edge Function + admin RPCs | `AdminManagement.tsx`, `manage-admin`, administrative migration | Department creation/edit/status, manager invitation/status | Admin session plus Edge Function role check |

## Authentication form

The reusable `auth-*` family owns all public sign-in, citizen registration, recovery, and new-password fields. Native controls are used with visible labels, Portuguese validation, `noValidate`, correct autocomplete values, inline feedback, and visible keyboard focus. Password visibility is an accessible toggle and is not persisted.

## Routes and roles

`#/acesso` is the access-area chooser. `#/acesso?tipo=cidadao`, `#/acesso?tipo=gestor`, and `#/acesso?tipo=colaborador` share one Supabase Auth session but communicate different entry contexts. Public registration always creates a citizen. After login, the selected context is compared with the role returned by `current_profile()`; a mismatch never redirects into the requested area. A requested route is honoured only when permitted by the current profile role: citizen to `/relatar` or `/meus-relatos`, manager to `/gestor…`, and collaborator to `/colaborador`. Otherwise users go to their role home. This client behavior complements, never replaces, the route and RLS checks.

An account with `accountStatus !== active`, or a collaborator with `active === false`, cannot open an authenticated area. The UI explains the restriction and permits sign-out; the database RPCs and auth ban remain the enforcing authority.

`#/admin/login` is not linked from the public chooser. Only `admin` profiles can use `#/admin/secretarias` and `#/admin/gestores`; direct navigation by another role returns the access screen with a specific permission message. Administrative mutations go through the trusted `manage-admin` Edge Function, which rechecks the calling session and role before using server-only credentials. The administrator flow uses inline success/error feedback and a native modal confirmation before activating or deactivating a department or manager.

The administrative header links to the existing `#/gestor` and `#/colaborador` interfaces. These routes select a view while the Supabase session and `current_profile()` keep the real `admin` identity. Reloads retain the view through the route; “Voltar à Administração” returns to `#/admin/secretarias`. The city-wide manager workflow has no department filter, so an administrator needs no invented department binding. Its existing RPCs accept an active administrator through `is_manager()`. The collaborator is an assigned field worker who starts services, records progress, and submits completion. Administrators see existing assigned services through separate admin-only RPCs; field actions record their own profile ID in `execution_updates.actor_id` and `occurrence_history.actor_id`, without taking an assignee's identity. The Edge Function for manager-owned collaborator administration also accepts active administrators. Database role checks, not the selected route, enforce these permissions.

The administrative header also links to `#/cidadao`. Every citizen-view link keeps the `/cidadao` route prefix, so refresh and navigation retain that mode. An active administrator can use the existing citizen pages without changing their profile. Citizen reports submitted in this mode keep the administrator's real ID as `reporter_id`, media `created_by`, and history `actor_id`; the `create_occurrence` RPC continues to reject other non-citizen roles. The citizen view shows “Visualizando como Cidadão” and a return link instead of a sign-out control.

## Auth feedback and asynchronous state

Each remote mutation is pessimistic: the primary action is disabled while pending, then success or error is announced in the form. Credential errors stay generic. Errors preserve non-sensitive fields and never expose raw provider messages. A missing profile after a valid session is explained as an account-access issue with a sign-out recovery path.

## Password recovery and invitations

Recovery requests call `resetPasswordForEmail` with the public `#/acesso` return route. The password form is shown when Supabase emits `PASSWORD_RECOVERY`, and also supports recovery/invite URL markers for email-link flows. `updateUser` is available only on that new-password screen. Supabase redirect URLs must include the deployed and localhost domains documented in `docs/SUPABASE.md`.

## Accessibility and responsive behavior

Feedback uses live regions and errors use alert semantics. Fields describe their associated errors with `aria-describedby`. At widths below 900px, the presentation panel condenses into a branded mobile header; no field or action relies on hover and all controls remain full-width and touch-friendly.

## Native controls

`Select/Listbox` and `Date` are platform-native controls across the application. The product accepts operating-system popup geometry and locale behavior for these operational filters and datetime fields; styling applies only to their closed control. Authentication does not introduce select or date controls.
