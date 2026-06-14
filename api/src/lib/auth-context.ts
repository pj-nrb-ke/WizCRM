export type JwtUser = {
  sub: string;
  organizationId: string;
  email: string;
  role: string;
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}
