import re
from datetime import date
from django import forms

from registrar.models import ClergyRecord, ClergyDeployment

from .models import ClergyProfile


class ClergyProfileForm(forms.ModelForm):
    """The clergy-only fields the Registrar never tracks."""

    class Meta:
        model = ClergyProfile
        fields = [
            'place_of_birth', 'civil_status',
            'baptism_place', 'confirmation_place',
            'education', 'other_information',
            'marriage_date', 'marriage_place', 'spouse_name', 'spouse_birth_date', 'children_names',
            'sss_number', 'philhealth_number', 'pagibig_number',
        ]
        widgets = {
            'marriage_date': forms.DateInput(attrs={'type': 'date'}),
            'spouse_birth_date': forms.DateInput(attrs={'type': 'date'}),
        }

    def clean_sss_number(self):
        val = (self.cleaned_data.get('sss_number') or '').strip()
        if not val:
            return ''
        from ednp import encryption
        if encryption.is_encrypted_text(val):
            raise forms.ValidationError('Enter a valid value.')
        digits = re.sub(r'\D', '', val)
        if len(digits) != 10:
            raise forms.ValidationError('SSS number must be 10 digits (format: XX-XXXXXXX-X).')
        return f"{digits[:2]}-{digits[2:9]}-{digits[9]}"

    def clean_philhealth_number(self):
        val = (self.cleaned_data.get('philhealth_number') or '').strip()
        if not val:
            return ''
        from ednp import encryption
        if encryption.is_encrypted_text(val):
            raise forms.ValidationError('Enter a valid value.')
        digits = re.sub(r'\D', '', val)
        if len(digits) != 12:
            raise forms.ValidationError('PhilHealth number must be 12 digits (format: XX-XXXXXXXXX-X).')
        return f"{digits[:2]}-{digits[2:11]}-{digits[11]}"

    def clean_pagibig_number(self):
        val = (self.cleaned_data.get('pagibig_number') or '').strip()
        if not val:
            return ''
        from ednp import encryption
        if encryption.is_encrypted_text(val):
            raise forms.ValidationError('Enter a valid value.')
        digits = re.sub(r'\D', '', val)
        if len(digits) != 12:
            raise forms.ValidationError('Pag-IBIG MID number must be 12 digits (format: XXXX-XXXX-XXXX).')
        return f"{digits[:4]}-{digits[4:8]}-{digits[8:]}"

    def clean_spouse_birth_date(self):
        dob = self.cleaned_data.get('spouse_birth_date')
        if dob and dob > date.today():
            raise forms.ValidationError('Spouse birth date cannot be in the future.')
        return dob

    def clean_marriage_date(self):
        m_date = self.cleaned_data.get('marriage_date')
        if m_date and m_date > date.today():
            raise forms.ValidationError('Marriage date cannot be in the future.')
        return m_date

    def clean(self):
        cleaned_data = super().clean()
        civil_status = cleaned_data.get('civil_status')
        if civil_status == 'Single':
            # Single clergy cannot have spouse or marriage records
            cleaned_data['marriage_date'] = None
            cleaned_data['marriage_place'] = ''
            cleaned_data['spouse_name'] = ''
            cleaned_data['spouse_birth_date'] = None
            cleaned_data['children_names'] = ''
        else:
            spouse_dob = cleaned_data.get('spouse_birth_date')
            marriage_date = cleaned_data.get('marriage_date')
            if spouse_dob and marriage_date and spouse_dob >= marriage_date:
                self.add_error('marriage_date', 'Marriage date cannot be earlier than spouse birth date.')

        return cleaned_data


class ClergyRecordSelfServiceForm(forms.ModelForm):
    """The subset of ClergyRecord fields a clergy member may edit about
    themselves from My Profile: includes personal information, Holy Orders and
    Ordination history; excludes assignment, status, rank, and
    contract/retirement dates which stay Registrar-controlled."""

    class Meta:
        model = ClergyRecord
        # No 'phone': the contact number is the verified one on the account and
        # only changes through a code sent to the new number.
        fields = [
            'name', 'gender', 'date_of_birth', 'baptism_date', 'confirmation_date',
            'email', 'address',
            'diaconate_date', 'diaconate_place', 'ordination_date', 'ordination_place',
            'holy_orders_date', 'bishop_name', 'consecration_date',
        ]
        widgets = {
            'date_of_birth': forms.DateInput(attrs={'type': 'date'}),
            'baptism_date': forms.DateInput(attrs={'type': 'date'}),
            'confirmation_date': forms.DateInput(attrs={'type': 'date'}),
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
        rank = self.instance.rank if self.instance else 'deacon'
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

        dob = cleaned_data.get('date_of_birth')
        baptism = cleaned_data.get('baptism_date')
        confirmation = cleaned_data.get('confirmation_date')
        diaconate = cleaned_data.get('diaconate_date')
        ordination = cleaned_data.get('ordination_date')
        consecration = cleaned_data.get('consecration_date')
        holy_orders = cleaned_data.get('holy_orders_date')

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

        if baptism and confirmation and baptism > confirmation:
            self.add_error('confirmation_date', 'Confirmation date cannot be earlier than baptism date.')

        if diaconate and ordination and diaconate > ordination:
            self.add_error('ordination_date', 'Priesthood ordination date cannot be earlier than Diaconate ordination date.')
        if ordination and consecration and ordination > consecration:
            self.add_error('consecration_date', 'Bishop consecration date cannot be earlier than Priesthood ordination date.')
        if diaconate and consecration and diaconate > consecration:
            self.add_error('consecration_date', 'Bishop consecration date cannot be earlier than Diaconate ordination date.')
        return cleaned_data
