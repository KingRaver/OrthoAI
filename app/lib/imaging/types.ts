export interface ImagingStudy {
  id: string;
  case_id: string | null;
  study_type: string;
  modality: string | null;
  body_part: string | null;
  laterality: 'left' | 'right' | 'bilateral' | null;
  study_date: string | null;
  description: string | null;
  file_path: string | null;
  dicom_metadata: DicomMetadata | null;
  findings: string | null;
  impression: string | null;
  created_at: string;
  updated_at: string;
}

export interface DicomMetadata {
  patientId?: string;
  patientName?: string;
  studyInstanceUid?: string;
  seriesInstanceUid?: string;
  sopInstanceUid?: string;
  manufacturer?: string;
  institution?: string;
  stationName?: string;
  windowCenter?: number;
  windowWidth?: number;
  rows?: number;
  columns?: number;
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  kvp?: number;
  exposureTime?: number;
  tubeVoltage?: number;
}

export interface ImagingAnnotation {
  id: string;
  study_id: string;
  annotation_type: AnnotationType;
  label: string | null;
  data: AnnotationData;
  created_at: string;
  updated_at: string;
}

export type AnnotationType =
  | 'length'
  | 'angle'
  | 'ellipse'
  | 'rectangle'
  | 'freehand'
  | 'arrow'
  | 'text'
  | 'landmark';

export interface AnnotationData {
  // Common fields
  handles?: Point[];
  // Length measurement
  length?: number;
  unit?: string;
  // Angle measurement
  angle?: number;
  // Text annotation
  text?: string;
  // Ellipse/Rectangle
  area?: number;
  // Freehand
  points?: Point[];
}

export interface Point {
  x: number;
  y: number;
}

export interface FindingTemplate {
  id: string;
  name: string;
  category: string | null;
  modality: string | null;
  body_part: string | null;
  template_text: string;
  variables: string[];
  created_at: string;
}

export interface StudyComparison {
  id: string;
  study_id_1: string;
  study_id_2: string;
  comparison_type: 'pre_post' | 'left_right' | 'serial' | null;
  notes: string | null;
  created_at: string;
}

export interface StudyInput {
  case_id?: string | null;
  study_type: string;
  modality?: string | null;
  body_part?: string | null;
  laterality?: 'left' | 'right' | 'bilateral' | null;
  study_date?: string | null;
  description?: string | null;
  file_path?: string | null;
  dicom_metadata?: DicomMetadata | null;
  findings?: string | null;
  impression?: string | null;
}

export interface AnnotationInput {
  study_id: string;
  annotation_type: AnnotationType;
  label?: string | null;
  data: AnnotationData;
}

export interface StudySearchOptions {
  case_id?: string;
  study_type?: string;
  modality?: string;
  body_part?: string;
  limit?: number;
}
