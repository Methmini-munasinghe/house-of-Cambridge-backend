import transporter from '../config/mailer.js';

const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
};

export default sendEmail;