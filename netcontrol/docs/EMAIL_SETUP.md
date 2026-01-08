# Email Configuration Guide

This guide explains how to configure email settings in NetControl, including support for email servers that require no authentication.

## Email Server Types

### 1. Authenticated Email Servers (Gmail, Outlook, etc.)
These servers require username and password authentication:

- **SMTP Host**: smtp.gmail.com
- **SMTP Port**: 587 (STARTTLS) or 465 (SSL)
- **Use SSL/TLS**: ✓ (for port 465)
- **Use STARTTLS**: ✓ (for port 587, recommended)
- **No authentication required**: ☐ (unchecked)
- **SMTP Username**: your-email@gmail.com
- **SMTP Password**: your-app-password

### 2. No-Authentication Email Servers (Local/Internal)
These servers don't require authentication (common in internal networks):

- **SMTP Host**: mail.yourcompany.local
- **SMTP Port**: 25 or 587
- **Use SSL/TLS**: ☐ (usually unchecked for internal servers)
- **Use STARTTLS**: ☐ (usually unchecked for internal servers)
- **No authentication required**: ✓ (checked)
- **SMTP Username**: (disabled when no-auth is checked)
- **SMTP Password**: (disabled when no-auth is checked)

## Configuration Steps

1. **Access Settings**: Navigate to Settings → Email/SMTP Settings
2. **Fill in Server Details**: Enter your SMTP host and port
3. **Choose Security Method**:
   - **SSL/TLS**: Use for port 465 (encrypted from start)
   - **STARTTLS**: Use for port 587 (starts plain, upgrades to encrypted)
   - **Neither**: Only for trusted internal networks
4. **Choose Authentication Method**:
   - For authenticated servers: Leave "No authentication required" unchecked and fill in username/password
   - For no-auth servers: Check "No authentication required" (username/password fields will be hidden)
5. **Configure From Address**: Set the email address and name that emails will appear to come from
6. **Test Configuration**: 
   - Click "Test SMTP" to verify connection
   - Click "Send Test Email" to send an actual test email

## Common Email Provider Settings

### Gmail
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SSL/TLS: No
STARTTLS: Yes
Authentication: Required
Username: your-email@gmail.com
Password: App Password (not regular password)
```

### Outlook/Hotmail
```
SMTP Host: smtp-mail.outlook.com
SMTP Port: 587
SSL/TLS: No
STARTTLS: Yes
Authentication: Required
Username: your-email@outlook.com
Password: Your account password
```

### Yahoo Mail
```
SMTP Host: smtp.mail.yahoo.com
SMTP Port: 587
SSL/TLS: No
STARTTLS: Yes
Authentication: Required
Username: your-email@yahoo.com
Password: App Password
```

### Office 365
```
SMTP Host: smtp.office365.com
SMTP Port: 587
SSL/TLS: No
STARTTLS: Yes
Authentication: Required
Username: your-email@yourdomain.com
Password: Your account password
```

## Common No-Auth Server Examples

### Internal Mail Relay
```
SMTP Host: mail.internal.company.com
SMTP Port: 25
SSL/TLS: No
STARTTLS: No
No authentication required: Yes
```

### Local Postfix/Sendmail
```
SMTP Host: localhost
SMTP Port: 25
SSL/TLS: No
STARTTLS: No
No authentication required: Yes
```

### Docker Mail Container
```
SMTP Host: mailhog (container name)
SMTP Port: 1025
SSL/TLS: No
STARTTLS: No
No authentication required: Yes
```

## Security Options Explained

### SSL/TLS vs STARTTLS
- **SSL/TLS (port 465)**: Connection is encrypted from the start
- **STARTTLS (port 587)**: Connection starts unencrypted, then upgrades to encrypted
- **STARTTLS is recommended** for modern email providers as it's more flexible

### When to Use Each Option
- **Port 465 + SSL/TLS**: Legacy secure connection method
- **Port 587 + STARTTLS**: Modern recommended method for most providers
- **Port 25 + No encryption**: Only for trusted internal networks

## Troubleshooting

### Connection Issues
- Verify the SMTP host and port are correct
- Check if the server is accessible from your network
- For internal servers, ensure firewall rules allow SMTP traffic

### Authentication Errors
- For authenticated servers: Verify username and password are correct
- For no-auth servers: Ensure "No authentication required" is checked
- Some servers may require specific authentication methods not supported by basic SMTP

### Email Delivery Issues
- Check spam/junk folders
- Verify the "From Email" address is valid
- Some servers may require the "From Email" to match the authenticated user

## Security Considerations

- **No-Auth Servers**: Only use on trusted internal networks
- **Authenticated Servers**: Use app-specific passwords when available
- **SSL/TLS**: Always use encryption when possible, especially over public networks
- **STARTTLS**: Preferred method for secure email transmission on port 587
- **Firewall**: Restrict SMTP access to necessary hosts only