import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { THROTTLE_LIMIT_FORGOT, THROTTLE_LIMIT_LOGIN, THROTTLE_TTL_MS } from '../../config/throttle.config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { ActivateDto } from './dto/activate.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// Endpoints publics : limités en débit par IP (ANO-002). Les routes sensibles
// (connexion, réinitialisation) portent des seuils plus stricts que le défaut.
@ApiTags('auth')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register-organization')
  @ApiOperation({ summary: 'Créer une organisation et son administrateur (compte à activer par email)' })
  @ApiResponse({ status: 201, description: "Organisation créée, lien d'activation envoyé" })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async registerOrganization(@Body() dto: RegisterOrganizationDto) {
    return this.authService.registerOrganization(dto);
  }

  @Get('activation/:token')
  @ApiOperation({ summary: "Valider un token d'activation et récupérer email + rôle" })
  @ApiResponse({
    status: 200,
    description: 'Token valide',
    schema: { example: { email: 'john@acme.com', role: 'AGENT' } },
  })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  async getActivation(@Param('token') token: string) {
    return this.authService.getActivation(token);
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activer un compte (nom + mot de passe) et obtenir un token' })
  @ApiResponse({
    status: 200,
    description: 'Compte activé, retourne un access_token',
    schema: { example: { access_token: 'eyJhbGci...' } },
  })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré / données invalides' })
  async activate(@Body() dto: ActivateDto) {
    return this.authService.activate(dto);
  }

  @Post('login')
  @Throttle({ default: { ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT_LOGIN } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se connecter et obtenir un token' })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie, retourne un access_token',
    schema: { example: { access_token: 'eyJhbGci...' } },
  })
  @ApiResponse({ status: 401, description: 'Identifiants invalides ou compte non activé' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT_FORGOT } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demander un lien de réinitialisation de mot de passe' })
  @ApiResponse({
    status: 200,
    description: 'Réponse générique, que le compte existe ou non',
    schema: { example: { message: 'Si un compte existe pour cet email, un lien a été envoyé.' } },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Get('reset-password/:token')
  @ApiOperation({ summary: "Valider un token de reset et récupérer l'email associé" })
  @ApiResponse({ status: 200, description: 'Token valide', schema: { example: { email: 'john@acme.com' } } })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  async getResetPassword(@Param('token') token: string) {
    return this.authService.getResetPassword(token);
  }

  @Post('reset-password')
  @Throttle({ default: { ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT_LOGIN } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Définir un nouveau mot de passe via un token de reset' })
  @ApiResponse({ status: 200, description: 'Mot de passe mis à jour' })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré / mot de passe invalide' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
