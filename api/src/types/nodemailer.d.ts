declare module 'nodemailer' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodemailer: { createTransport(options: unknown): { sendMail(mail: unknown): Promise<unknown> } };
  export default nodemailer;
  export function createTransport(options: unknown): { sendMail(mail: unknown): Promise<unknown> };
}
