import os
from datetime import date

from django import forms

from . import images
from .models import ClergyRecord, ClergyDeployment, DocumentType


class ClergyRecordForm(forms.ModelForm):
    class Meta:
        model = ClergyRecord
        fields = ['name', 'deanery', 'assignment', 'status', 'leave_reason', 'rank', 'holy_orders_date', 'baptism_date', 'confirmation_date', 'contract_end']
        widgets = {
            'holy_orders_date': forms.DateInput(attrs={'type': 'date'}),
            'baptism_date': forms.DateInput(attrs={'type': 'date'}),
            'confirmation_date': forms.DateInput(attrs={'type': 'date'}),
            'contract_end': forms.DateInput(attrs={'type': 'date'}),
        }

    def clean_name(self):
        val = self.cleaned_data.get('name')
        if not val or not val.strip():
            raise forms.ValidationError('Clergy name is required.')
        return val.strip()

    def clean_assignment(self):
        assignment = self.cleaned_data.get('assignment')
        return assignment.strip() if assignment else ''

    def clean(self):
        cleaned_data = super().clean()
        rank = cleaned_data.get('rank')
        if rank == 'postulancy':
            cleaned_data['holy_orders_date'] = None

        status = cleaned_data.get('status')
        leave_reason = (cleaned_data.get('leave_reason') or '').strip()
        if status == 'On Leave' and not leave_reason:
            self.add_error('leave_reason', 'Leave reason is required when status is On Leave.')

        baptism_date = cleaned_data.get('baptism_date')
        confirmation_date = cleaned_data.get('confirmation_date')
        if baptism_date and confirmation_date and baptism_date > confirmation_date:
            self.add_error('confirmation_date', 'Confirmation date cannot be earlier than baptism date.')

        holy_orders_date = cleaned_data.get('holy_orders_date')
        contract_end = cleaned_data.get('contract_end')
        if holy_orders_date and contract_end and holy_orders_date > contract_end:
            self.add_error('contract_end', 'Contract end cannot be earlier than Holy Orders admission date.')

        return cleaned_data


class PersonalInfoForm(forms.ModelForm):
    class Meta:
        model = ClergyRecord
        # No 'phone': it is the number the clergy member verified by text code,
        # so the registrar can't overwrite it from here.
        fields = ['name', 'date_of_birth', 'gender', 'baptism_date', 'confirmation_date',
                  'email', 'address', 'deanery', 'assignment', 'status', 'leave_reason', 'rank',
                  'contract_end', 'retirement_date',
                  'diaconate_date', 'diaconate_place', 'ordination_date', 'holy_orders_date', 'ordination_place',
                  'bishop_name', 'consecration_date']
        widgets = {
            'date_of_birth': forms.DateInput(attrs={'type': 'date'}),
            'baptism_date': forms.DateInput(attrs={'type': 'date'}),
            'confirmation_date': forms.DateInput(attrs={'type': 'date'}),
            'contract_end': forms.DateInput(attrs={'type': 'date'}),
            'retirement_date': forms.DateInput(attrs={'type': 'date'}),
            'diaconate_date': forms.DateInput(attrs={'type': 'date'}),
            'ordination_date': forms.DateInput(attrs={'type': 'date'}),
            'holy_orders_date': forms.DateInput(attrs={'type': 'date'}),
            'consecration_date': forms.DateInput(attrs={'type': 'date'}),
        }

    def clean_name(self):
        name = self.cleaned_data.get('name', '').strip()
        if not name:
            raise forms.ValidationError('Name is required.')
        return name

    def clean_date_of_birth(self):
        dob = self.cleaned_data.get('date_of_birth')
        if dob and dob > date.today():
            raise forms.ValidationError('Date of birth cannot be in the future.')
        return dob

    def clean(self):
        cleaned_data = super().clean()
        rank = cleaned_data.get('rank')
        if rank == 'postulancy':
            cleaned_data['diaconate_date'] = None
            cleaned_data['diaconate_place'] = ''
            cleaned_data['ordination_date'] = None
            cleaned_data['ordination_place'] = ''
            cleaned_data['consecration_date'] = None
            cleaned_data['holy_orders_date'] = None
        elif rank == 'deacon':
            cleaned_data['ordination_date'] = None
            cleaned_data['ordination_place'] = ''
            cleaned_data['consecration_date'] = None
        elif rank == 'priest':
            cleaned_data['consecration_date'] = None

        status = cleaned_data.get('status')
        leave_reason = (cleaned_data.get('leave_reason') or '').strip()
        if status == 'On Leave' and not leave_reason:
            self.add_error('leave_reason', 'Leave reason is required when status is On Leave.')

        dob = cleaned_data.get('date_of_birth')
        baptism = cleaned_data.get('baptism_date')
        confirmation = cleaned_data.get('confirmation_date')
        diaconate = cleaned_data.get('diaconate_date')
        ordination = cleaned_data.get('ordination_date')
        consecration = cleaned_data.get('consecration_date')
        holy_orders = cleaned_data.get('holy_orders_date')
        contract_end = cleaned_data.get('contract_end')
        retirement = cleaned_data.get('retirement_date')

        if dob:
            if baptism and baptism < dob:
                self.add_error('baptism_date', 'Baptism date cannot be earlier than date of birth.')
            if confirmation and confirmation < dob:
                self.add_error('confirmation_date', 'Confirmation date cannot be earlier than date of birth.')
            if diaconate and diaconate < dob:
                self.add_error('diaconate_date', 'Diaconate ordination date cannot be earlier than date of birth.')
            if ordination and ordination < dob:
                self.add_error('ordination_date', 'Priesthood ordination date cannot be earlier than date of birth.')
            if holy_orders and holy_orders < dob:
                self.add_error('holy_orders_date', 'Holy Orders admission date cannot be earlier than date of birth.')
            if consecration and consecration < dob:
                self.add_error('consecration_date', 'Bishop consecration date cannot be earlier than date of birth.')
            if retirement and retirement < dob:
                self.add_error('retirement_date', 'Retirement date cannot be earlier than date of birth.')
            if contract_end and contract_end < dob:
                self.add_error('contract_end', 'Contract end cannot be earlier than date of birth.')

        if baptism and confirmation and baptism > confirmation:
            self.add_error('confirmation_date', 'Confirmation date cannot be earlier than baptism date.')

        if diaconate and ordination and diaconate > ordination:
            self.add_error('ordination_date', 'Priesthood ordination date cannot be earlier than Diaconate ordination date.')
        if ordination and consecration and ordination > consecration:
            self.add_error('consecration_date', 'Bishop consecration date cannot be earlier than Priesthood ordination date.')
        if diaconate and consecration and diaconate > consecration:
            self.add_error('consecration_date', 'Bishop consecration date cannot be earlier than Diaconate ordination date.')
        return cleaned_data


class ClergyDeploymentForm(forms.ModelForm):
    class Meta:
        model = ClergyDeployment
        fields = ['station_name', 'place_name', 'role', 'start_date', 'end_date', 'is_current', 'notes']
        widgets = {
            'start_date': forms.DateInput(attrs={'type': 'date'}),
            'end_date': forms.DateInput(attrs={'type': 'date'}),
        }

    def clean_station_name(self):
        station = self.cleaned_data.get('station_name', '').strip()
        if not station:
            raise forms.ValidationError('Parish or station name is required.')
        return station

    def clean(self):
        cleaned_data = super().clean()
        start_date = cleaned_data.get('start_date')
        end_date = cleaned_data.get('end_date')
        is_current = cleaned_data.get('is_current')

        if is_current and end_date:
            cleaned_data['end_date'] = None
            end_date = None

        if start_date and end_date and start_date > end_date:
            self.add_error('end_date', 'End date cannot be earlier than start date.')

        return cleaned_data


# What can be uploaded at all (a photo straight off a phone fits), and what may be stored: a PDF
# as it is, or a photo or scan once it has been shrunk (registrar/images.py), which almost
# always brings it well under.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_STORED_BYTES = 5 * 1024 * 1024   # 5 MB
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}

# extension -> the leading bytes a genuine file of that type starts with.
# Checking content as well as the extension stops e.g. an HTML/script file
# being uploaded as "scan.pdf". SVG is deliberately not allowed: it can carry
# script and would run in the site's origin if opened inline.
DOCUMENT_SIGNATURES = {
    '.pdf': (b'%PDF-',),
    '.jpg': (b'\xff\xd8\xff',),
    '.jpeg': (b'\xff\xd8\xff',),
    '.png': (b'\x89PNG\r\n\x1a\n',),
}


class DocumentUploadForm(forms.Form):
    document_type = forms.ModelChoiceField(queryset=DocumentType.objects.all())
    file = forms.FileField()
    notes = forms.CharField(max_length=255, required=False)

    def clean_document_type(self):
        doc_type = self.cleaned_data['document_type']
        if doc_type.is_noted_only:
            raise forms.ValidationError(f"{doc_type.name} does not accept file uploads; it is noted directly.")
        return doc_type

    def clean_file(self):
        upload = self.cleaned_data['file']
        if upload.size > MAX_UPLOAD_BYTES:
            raise forms.ValidationError('File is too large — the maximum is 10 MB for a photo or scan, and 5 MB for a PDF.')
        extension = os.path.splitext(upload.name)[1].lower()
        signatures = DOCUMENT_SIGNATURES.get(extension)
        if not signatures:
            raise forms.ValidationError('Only PDF, JPG and PNG files are allowed.')
        header = upload.read(16)
        upload.seek(0)
        if not header.startswith(signatures):
            raise forms.ValidationError('That file does not look like a real PDF, JPG or PNG.')
        if extension in IMAGE_EXTENSIONS:
            upload = images.shrink(upload)
        if upload.size > MAX_STORED_BYTES:
            if extension == '.pdf':
                raise forms.ValidationError('That PDF is too large — the maximum is 5 MB. Scanning in black and white, '
                                            'or at 150–200 dpi, makes it smaller.')
            raise forms.ValidationError('That image is too large to store — the maximum is 5 MB. Please scan or '
                                        'photograph it at a lower resolution.')
        return upload


EMBER_MIN_YEAR = 1950
EMBER_MAX_BYTES = 5 * 1024 * 1024  # 5 MB


class EmberLetterUploadForm(forms.Form):
    year = forms.IntegerField()
    quarter = forms.IntegerField(min_value=1, max_value=4)
    file = forms.FileField()

    def clean_year(self):
        year = self.cleaned_data['year']
        current_year = date.today().year
        if year < EMBER_MIN_YEAR or year > current_year:
            raise forms.ValidationError(f'Year must be between {EMBER_MIN_YEAR} and {current_year}.')
        return year

    def clean_file(self):
        upload = self.cleaned_data['file']
        if upload.size > EMBER_MAX_BYTES:
            raise forms.ValidationError('File is too large — the maximum is 5 MB.')
        extension = os.path.splitext(upload.name)[1].lower()
        signatures = DOCUMENT_SIGNATURES.get(extension)
        if not signatures:
            raise forms.ValidationError('Only PDF, JPG and PNG files are allowed.')
        header = upload.read(16)
        upload.seek(0)
        if not header.startswith(signatures):
            raise forms.ValidationError('That file does not look like a real PDF, JPG or PNG.')
        if extension in IMAGE_EXTENSIONS:
            upload = images.shrink(upload)
        if upload.size > EMBER_MAX_BYTES:
            raise forms.ValidationError('File is too large — the maximum is 5 MB.')
        return upload


class ProfilePictureForm(forms.Form):
    profile_picture = forms.FileField()

    def clean_profile_picture(self):
        upload = self.cleaned_data['profile_picture']
        if upload.size > MAX_STORED_BYTES:
            raise forms.ValidationError('Image is too large — the maximum is 5 MB.')
        extension = os.path.splitext(upload.name)[1].lower()
        if extension not in IMAGE_EXTENSIONS:
            raise forms.ValidationError('Only JPG and PNG images are allowed for a profile picture.')
        signatures = DOCUMENT_SIGNATURES.get(extension)
        header = upload.read(16)
        upload.seek(0)
        if not signatures or not header.startswith(signatures):
            raise forms.ValidationError('That file does not look like a real JPG or PNG image.')
        upload = images.shrink_avatar(upload)
        if upload.size > MAX_STORED_BYTES:
            raise forms.ValidationError('That image is too large to store — the maximum is 5 MB.')
        return upload


def first_error(form):
    """The first validation message on a form, for showing in a flash message."""
    for errors in form.errors.values():
        return errors[0]
    return None
