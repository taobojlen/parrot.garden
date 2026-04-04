# Truncate with source link

When a rendered post exceeds a target's character limit, optionally truncate the text and append the source URL so readers can find the full content.

## Behavior

Given a connection with `truncateWithLink` enabled:

1. Render the template with feed item variables (existing `renderTemplate`).
2. Check whether the rendered text exceeds the target's character limit (`maxCharacters` for Mastodon, 300 for Bluesky).
3. **If it fits:** post as-is. No link is appended.
4. **If it exceeds the limit:** append `\n\n<item link>` to the rendered text, then pass the result through `truncatePost`. The existing trailing-URL-aware truncation will shorten the text portion while preserving the link at the end.

The option is only available when the template does **not** already contain `{{link}}`. If the template includes `{{link}}`, the link is already present and the existing truncation logic handles it.

## Database

Add a boolean column to the `connection` table:

- Column: `truncate_with_link`
- Type: integer (boolean mode)
- Default: `false`
- Migration required

## Template rendering changes

In `processConnectionItems` (server/utils/poll.ts), between rendering the template and calling `truncatePost`:

- If `truncateWithLink` is enabled and the rendered text exceeds `maxCharacters`, append `\n\n<item.link>` to the rendered text before passing it to `truncatePost`.
- If `truncateWithLink` is disabled or the text fits, pass the rendered text to `truncatePost` unchanged (existing behavior).

No changes to `renderTemplate` or `truncatePost` themselves.

## UI changes

On the connection create and edit forms:

- Add a checkbox: "Truncate and add source link if post is too long"
- The checkbox is disabled (greyed out) when the template textarea contains the literal string `{{link}}`.
- When disabled, the checkbox value is forced to `false`.

## API changes

Connection create and update endpoints accept an optional `truncateWithLink` boolean field. The API enforces the constraint: if the template contains `{{link}}`, `truncateWithLink` must be `false`.

## Testing

- Unit test: rendered text under limit with `truncateWithLink` enabled -> no link appended, text unchanged.
- Unit test: rendered text over limit with `truncateWithLink` enabled -> link appended, text truncated with trailing URL preserved.
- Unit test: `truncateWithLink` enabled but template already contains `{{link}}` -> link not appended (existing behavior).
- Unit test: `truncateWithLink` disabled, text over limit -> existing truncation behavior unchanged.
