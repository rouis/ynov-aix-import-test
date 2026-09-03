import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { PresignedUrlRequestDto, PresignedUrlResponseDto } from './dto/presigned-url.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthUser } from 'src/common/types/auth-user.type';

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Obtenir une URL présignée pour uploader un fichier vers MinIO' })
  @ApiResponse({ status: 201, type: PresignedUrlResponseDto })
  getPresignedUrl(
    @Body() dto: PresignedUrlRequestDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PresignedUrlResponseDto> {
    return this.uploadService.getPresignedUrl(user.organizationId, dto.filename);
  }
}
