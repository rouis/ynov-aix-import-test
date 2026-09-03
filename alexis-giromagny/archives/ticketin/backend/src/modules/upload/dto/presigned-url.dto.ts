import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PresignedUrlRequestDto {
  @ApiProperty({ example: 'capture-erreur.png', description: 'Nom du fichier à uploader' })
  @IsNotEmpty()
  @IsString()
  filename!: string;
}

export class PresignedUrlResponseDto {
  @ApiProperty({ description: 'URL présignée S3 pour le PUT' })
  url!: string;

  @ApiProperty({ description: 'Clé S3 du fichier' })
  key!: string;
}
