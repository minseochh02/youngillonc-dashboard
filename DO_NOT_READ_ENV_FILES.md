# CRITICAL REMINDER FOR CLAUDE

## DO NOT READ THESE FILES UNLESS EXPLICITLY ASKED:

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- Any file containing credentials, API keys, or sensitive data

## WHY:
- These files contain sensitive information (API keys, credentials, secrets)
- Reading them unnecessarily exposes sensitive data
- The user will provide the necessary information when needed
- Trust the user to give you what you need

## WHAT TO DO INSTEAD:
- Wait for the user to provide the information
- Ask the user for specific values if needed
- Use environment variables via process.env in code, don't read the actual file
- If the user says "use the API key from env", use process.env.NEXT_PUBLIC_EGDESK_API_KEY in code

## THIS IS A RECURRING ISSUE - STOP DOING IT!
