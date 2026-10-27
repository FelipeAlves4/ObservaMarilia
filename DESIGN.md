---
version: alpha
name: "ObservaMarília"
description: "Institutional urban-intelligence product with a calm, accountable civic interface."
colors:
  navy: "#0B1739"
  primary: "#2563EB"
  accent: "#2DD4BF"
  canvas: "#F5F7FB"
  surface: "#FFFFFF"
  textMuted: "#667085"
typography:
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
rounded:
  card: "20px"
  field: "12px"
  control: "12px"
spacing:
  compact: "8px"
  field: "16px"
  section: "32px"
components:
  authAside:
    backgroundColor: "{colors.navy}"
  authCard:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "46px"
  authField:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.field}"
    height: "50px"
  authPrimaryAction:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  authSignal:
    backgroundColor: "{colors.accent}"
  authSupportingCopy:
    textColor: "{colors.textMuted}"
  authCanvas:
    backgroundColor: "{colors.canvas}"
---

## Overview

ObservaMarília is an institutional urban-intelligence product for citizens, managers, and field collaborators. Its product register is calm, legible, and accountable: the visual language should feel like a dependable civic control room, not a generic consumer app. The authentication surface is the brand threshold: a deep navy city panel gives the product a recognisable civic signature, while the task area remains deliberately quiet.

## Colors

Navy anchors institutional surfaces and high-contrast presentation. Blue is reserved for the primary action and keyboard focus. Turquoise is a small, optimistic city signal rather than a second primary action. Canvas separates tasks from the application shell; surface carries forms and content. Muted text supports instructions but never replaces the main text color.

## Typography

Use Inter throughout. Titles are compact and confident, with tight letter spacing only at large sizes. Body and helper copy use normal case, direct Portuguese, and a readable line height. Avoid promotional all-caps or decorative type treatments in product workflows.

## Layout

Product screens use a responsive fluid layout. Authentication uses a two-part composition from 900px: the city narrative occupies the visual half and the focused form stays within 460px. Below 900px, the city panel becomes a compact branded header and the form retains comfortable outer margins. Controls remain at least 46px high.

## Elevation & Depth

Surfaces are mostly flat. A single restrained shadow separates the authentication card from the light canvas. Borders provide structure before shadow; no glass, gradients, or ornamental glow effects are used.

## Shapes

Cards use a 20px radius, fields and controls 12px. Buttons are softly rounded rectangles, never pills by default. The city signal motif is linear and structural, not decorative clutter.

## Components

Authentication is owned by the `auth-*` component family: `AuthLayout`, `AuthCard`, `AuthInput`, `PasswordInput`, and `AuthFeedback`. They own labels, invalid state, focus treatment, password visibility, and form feedback. Shared global buttons and administrative forms are not reused for the auth workflow.

## Do's and Don'ts

Do make every status specific about the next useful action. Do reserve vivid color for actions and meaningful status. Do preserve the requested protected destination only after checking the authenticated role. Do not expose raw Supabase errors, password values, or role-changing controls. Do not let auth styles alter occurrence or collaborator forms.
