import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketResponseDto } from './dto/ticket-response';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthUser } from 'src/common/types/auth-user.type';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un ticket (créateur = utilisateur courant)' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser): Promise<TicketResponseDto> {
    return this.ticketService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les tickets (CLIENT : uniquement les siens)' })
  @ApiResponse({ status: 200, type: [TicketResponseDto] })
  findAll(@CurrentUser() user: AuthUser): Promise<TicketResponseDto[]> {
    return this.ticketService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un ticket par ID (CLIENT : 404 si pas le sien)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<TicketResponseDto> {
    return this.ticketService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.AGENT)
  @ApiOperation({ summary: 'Mettre à jour un ticket (ADMIN ou AGENT)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @ApiResponse({ status: 403, description: 'Réservé aux ADMIN/AGENT' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TicketResponseDto> {
    return this.ticketService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un ticket (ADMIN)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Ticket supprimé' })
  @ApiResponse({ status: 403, description: 'Réservé aux ADMIN' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<void> {
    return this.ticketService.remove(id, user);
  }
}
