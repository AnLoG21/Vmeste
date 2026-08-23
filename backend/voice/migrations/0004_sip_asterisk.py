# Generated manually for SIP / Asterisk support

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('voice', '0003_tts_enabled'),
    ]

    operations = [
        migrations.AlterField(
            model_name='providervoicesettings',
            name='ats_provider',
            field=models.CharField(
                choices=[
                    ('generic', 'Generic JSON'),
                    ('asterisk', 'SIP / Asterisk (Вместе)'),
                    ('mango', 'Mango Office'),
                    ('novofon', 'Novofon / UIS'),
                ],
                default='generic',
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='providervoicesettings',
            name='sip_auth_user',
            field=models.CharField(blank=True, default='', help_text='Логин для регистрации, если отличается от username.', max_length=128),
        ),
        migrations.AddField(
            model_name='providervoicesettings',
            name='sip_did',
            field=models.CharField(blank=True, default='', help_text='Купленный SIP-номер (DID), на который звонят клиенты.', max_length=32),
        ),
        migrations.AddField(
            model_name='providervoicesettings',
            name='sip_password',
            field=models.CharField(blank=True, default='', max_length=128),
        ),
        migrations.AddField(
            model_name='providervoicesettings',
            name='sip_server',
            field=models.CharField(blank=True, default='', help_text='SIP-сервер оператора (host или sip:host:port).', max_length=128),
        ),
        migrations.AddField(
            model_name='providervoicesettings',
            name='sip_username',
            field=models.CharField(blank=True, default='', max_length=128),
        ),
    ]
