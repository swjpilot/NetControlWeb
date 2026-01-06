const nodemailer = require('nodemailer');
const Database = require('../database/db');

class EmailService {
  constructor() {
    this.db = new Database();
  }

  async getEmailSettings() {
    try {
      const settings = await this.db.getSettings([
        'smtp_host',
        'smtp_port', 
        'smtp_secure',
        'smtp_no_auth',
        'smtp_username',
        'smtp_password',
        'smtp_from_email',
        'smtp_from_name'
      ]);
      
      // Convert string values to appropriate types
      if (settings.smtp_port) settings.smtp_port = parseInt(settings.smtp_port);
      if (settings.smtp_secure) settings.smtp_secure = settings.smtp_secure === 'true';
      if (settings.smtp_no_auth) settings.smtp_no_auth = settings.smtp_no_auth === 'true';
      
      return settings;
    } catch (error) {
      console.error('Error getting email settings:', error);
      throw error;
    }
  }

  async createTransporter() {
    try {
      const settings = await this.getEmailSettings();
      
      if (!settings.smtp_host || !settings.smtp_port) {
        throw new Error('SMTP host and port are not configured');
      }

      const transporterConfig = {
        host: settings.smtp_host,
        port: settings.smtp_port || 587,
        secure: settings.smtp_secure || false
      };

      // Only add authentication if not disabled
      if (!settings.smtp_no_auth && settings.smtp_username && settings.smtp_password) {
        transporterConfig.auth = {
          user: settings.smtp_username,
          pass: settings.smtp_password
        };
      }

      return nodemailer.createTransporter(transporterConfig);
    } catch (error) {
      console.error('Error creating email transporter:', error);
      throw error;
    }
  }

  async sendEmail(options) {
    try {
      const settings = await this.getEmailSettings();
      const transporter = await this.createTransporter();

      const mailOptions = {
        from: `${settings.smtp_from_name || 'NetControl'} <${settings.smtp_from_email}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      // Override from address if specified
      if (options.from) {
        mailOptions.from = options.from;
      }

      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendTestEmail(to) {
    try {
      const result = await this.sendEmail({
        to: to,
        subject: 'NetControl SMTP Test',
        text: 'This is a test email from NetControl to verify SMTP configuration.',
        html: '<p>This is a test email from <strong>NetControl</strong> to verify SMTP configuration.</p>'
      });
      
      return result;
    } catch (error) {
      console.error('Error sending test email:', error);
      throw error;
    }
  }
}

module.exports = EmailService;