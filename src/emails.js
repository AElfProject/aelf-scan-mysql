/**
 * @file send emails
 * @author atom-yang
 * @date 2019-08-07
 */

const nodemailer = require('nodemailer');
const { config } = require('./common/constants');

const mailConfig = config.mails;

async function sendEmails(message = '') {
  const {
    type,
    from,
    to,
    subject,
    sendmailPath,
    smtpConfig
  } = mailConfig;
  try {
    let transporter;
    if (type === 'smtp') {
      transporter = nodemailer.createTransport(smtpConfig);
    } else {
      transporter = nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: sendmailPath
      });
    }

    // send mail with defined transport object
    const info = await transporter.sendMail({
      from, // sender address
      to: to.join(', '), // list of receivers
      subject, // Subject line
      text: subject,
      html: `<pre>${message.toString()}</b>${message.stack}</pre>` // html body
    });
    transporter.close();
    console.log('Message sent: %s', info.messageId);
  } catch (e) {
    console.error(e);
  }
}

module.exports = {
  sendEmails: process.env.NODE_ENV === 'production' ? sendEmails : () => {}
};
